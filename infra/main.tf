data "google_project" "atual" {}

# ---------------------------------------------------------------- APIs

resource "google_project_service" "apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
  ])
  service            = each.value
  disable_on_destroy = false
}

# ---------------------------------------------------------------- Imagens

resource "google_artifact_registry_repository" "servicos" {
  repository_id = "servicos"
  location      = var.regiao
  format        = "DOCKER"

  # Cada deploy publica uma imagem nova. Sem limpeza, o repositório (e a
  # cobrança de armazenamento) só cresce. Ficam as 10 mais recentes, o
  # bastante para voltar algumas versões.
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "manter-10-mais-recentes"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
  cleanup_policies {
    id     = "apagar-o-resto"
    action = "DELETE"
    condition {
      tag_state = "ANY"
    }
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------- Identidades

# Identidade do container em execução. Não recebe papel nenhum: a aplicação
# não chama API do Google. Sem esta conta dedicada, o Cloud Run usaria a
# conta padrão do Compute, que tem papel de editor no projeto inteiro.
resource "google_service_account" "tarefas_run" {
  account_id   = "tarefas-run"
  display_name = "Cloud Run: tarefas"
}

# Identidade da esteira de deploy. Publica imagens e revisões, nada além.
resource "google_service_account" "deploy" {
  account_id   = "deploy"
  display_name = "GitHub Actions: deploy"
}

resource "google_artifact_registry_repository_iam_member" "deploy_publica_imagens" {
  repository = google_artifact_registry_repository.servicos.name
  location   = var.regiao
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}

# O projeto existe só para este serviço, então o papel no nível do projeto
# não alcança nada além dele.
resource "google_project_iam_member" "deploy_publica_revisoes" {
  project = var.projeto
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Para criar uma revisão que roda como tarefas-run, o deploy precisa poder
# "agir como" ela. Só ela: nenhuma outra conta do projeto.
resource "google_service_account_iam_member" "deploy_usa_tarefas_run" {
  service_account_id = google_service_account.tarefas_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
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

  # O repositório é público e aceita pull request de qualquer pessoa. Só a
  # main deste repositório troca o token do GitHub por credencial do Google.
  attribute_condition = "assertion.repository == '${var.repositorio_github}' && assertion.ref == 'refs/heads/main'"
}

resource "google_service_account_iam_member" "github_age_como_deploy" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.repositorio_github}"
}

# ---------------------------------------------------------------- Cloud Run

resource "google_cloud_run_v2_service" "tarefas" {
  name                = "tarefas"
  location            = var.regiao
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account                  = google_service_account.tarefas_run.email
    max_instance_request_concurrency = 80
    timeout                          = "30s"

    # As tarefas vivem na memória do processo. Com duas instâncias, seriam
    # duas listas, e cada requisição cairia numa delas. Mínimo zero: sem
    # acesso, o serviço desliga e não custa nada.
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      # Imagem provisória. A real é publicada pela esteira de deploy.
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      startup_probe {
        period_seconds    = 3
        failure_threshold = 10
        http_get {
          path = "/api/saude"
        }
      }
    }
  }

  # Imagem e tráfego pertencem à esteira. Sem isto, cada `terraform apply`
  # desfaria o último deploy.
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

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "acesso_publico" {
  name     = google_cloud_run_v2_service.tarefas.name
  location = var.regiao
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------- Domínio

# Exige que a conta que roda o Terraform seja dona verificada do domínio no
# Google Search Console. O certificado é emitido pelo Google depois que o
# CNAME aponta para ghs.googlehosted.com.
resource "google_cloud_run_domain_mapping" "tarefas" {
  name     = var.dominio
  location = var.regiao

  metadata {
    namespace = var.projeto
  }

  spec {
    route_name = google_cloud_run_v2_service.tarefas.name
  }
}
