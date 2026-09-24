# Resource IDs in Google Cloud (service "tarefas", repository "servicos",
# secret "segredo-origem") were created before the code was translated to
# English. They stay as they are: renaming them would recreate the service
# and its domain certificate.

# ---------------------------------------------------------------- APIs

resource "google_project_service" "apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "secretmanager.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ---------------------------------------------------------------- Images

resource "google_artifact_registry_repository" "images" {
  repository_id = "servicos"
  location      = var.region
  format        = "DOCKER"

  # Every deploy publishes a new image. Without cleanup, the repository (and
  # the storage bill) only grows. The 10 most recent stay, enough to roll back
  # a few versions.
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "keep-10-most-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
  cleanup_policies {
    id     = "delete-the-rest"
    action = "DELETE"
    condition {
      tag_state = "ANY"
    }
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------- Identities

# Identity of the running container. Its only access is reading the origin
# secret (below). Without this dedicated account, Cloud Run would use the
# Compute default account, which is an editor of the whole project.
resource "google_service_account" "runtime" {
  account_id   = "tarefas-run"
  display_name = "Cloud Run runtime"
}

# Identity of the deploy pipeline. Publishes images and revisions, nothing else.
resource "google_service_account" "deploy" {
  account_id   = "deploy"
  display_name = "GitHub Actions: deploy"
}

resource "google_artifact_registry_repository_iam_member" "deploy_pushes_images" {
  repository = google_artifact_registry_repository.images.name
  location   = var.region
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}

# The project exists only for this service, so a project-level role reaches
# nothing beyond it.
resource "google_project_iam_member" "deploy_publishes_revisions" {
  project = var.project
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# To create a revision that runs as the runtime account, the deploy must be
# able to "act as" it. Only that one: no other account in the project.
resource "google_service_account_iam_member" "deploy_acts_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}

# ---------------------------------------------------------------- Origin secret

# Cloudflare adds this value in a header of every request, and the app rejects
# whatever arrives without it. That is what stops a robot from skipping
# Cloudflare by going straight to Cloud Run. The value is born here and lives
# in the Terraform state (private bucket) and in Secret Manager, never in the
# repository.
resource "random_password" "origin_secret" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret" "origin_secret" {
  secret_id = "segredo-origem"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "origin_secret" {
  secret      = google_secret_manager_secret.origin_secret.id
  secret_data = random_password.origin_secret.result
}

# The container reads the secret to check the header. The pipeline reads it to
# test the new revision directly on Cloud Run before releasing traffic.
resource "google_secret_manager_secret_iam_member" "origin_secret_readers" {
  for_each = {
    container = google_service_account.runtime.email
    deploy    = google_service_account.deploy.email
  }
  secret_id = google_secret_manager_secret.origin_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.value}"
}

# ---------------------------------------------------------------- Workload Identity

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
  depends_on                = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # The repository is public and accepts pull requests from anyone. Only this
  # repository's main branch can exchange the GitHub token for a Google
  # credential.
  attribute_condition = "assertion.repository == '${var.github_repository}' && assertion.ref == 'refs/heads/main'"
}

resource "google_service_account_iam_member" "github_acts_as_deploy" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# ---------------------------------------------------------------- Cloud Run

resource "google_cloud_run_v2_service" "app" {
  name                = "tarefas"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account                  = google_service_account.runtime.email
    max_instance_request_concurrency = 80
    timeout                          = "30s"

    # Tasks live in the process memory. With two instances there would be two
    # lists, and each request would land on one of them. Minimum zero: with no
    # traffic, the service scales down and costs nothing.
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      # Placeholder image. The real one is published by the deploy pipeline.
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8080
      }

      env {
        name = "ORIGIN_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.origin_secret.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      # TCP: ready as soon as the server accepts connections on the port. It
      # does not depend on any route, so it works for every image version.
      startup_probe {
        period_seconds    = 3
        failure_threshold = 10
        tcp_socket {
          port = 8080
        }
      }
    }
  }

  # Image and traffic belong to the pipeline. Without this, every
  # `terraform apply` would undo the last deploy.
  #
  # `gcloud run deploy` gives every revision a name, and ignoring it keeps
  # plans clean. The flip side: when a template change is made here,
  # Terraform would reuse the current revision's name with a different
  # configuration, and Cloud Run answers 409. For that one apply, remove
  # template[0].revision from the list below so Cloud Run names the new
  # revision itself, then put it back.
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      traffic,
      template[0].containers[0].image,
      template[0].revision,
      template[0].labels,
      template[0].annotations,
    ]
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_version.origin_secret,
    google_secret_manager_secret_iam_member.origin_secret_readers,
  ]
}

# Public at Google's level. Cloudflare filters robots, and the app itself
# rejects whatever did not go through Cloudflare.
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  name     = google_cloud_run_v2_service.app.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------- Domain

# Requires the account running Terraform to be a verified owner of the domain
# in Google Search Console. Google issues the certificate once the CNAME
# points to ghs.googlehosted.com.
resource "google_cloud_run_domain_mapping" "domain" {
  name     = var.domain
  location = var.region

  metadata {
    namespace = var.project
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
