# The first three go into the repository's GitHub Variables (Settings, Secrets
# and variables, Actions). On their own they grant access to nothing.

output "GCP_PROJECT" {
  value = var.project
}

output "GCP_WORKLOAD_IDENTITY_PROVIDER" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "GCP_SERVICE_ACCOUNT" {
  value = google_service_account.deploy.email
}

output "dns_records" {
  description = "What to create in DNS for the domain to point at Cloud Run."
  value       = google_cloud_run_domain_mapping.domain.status[0].resource_records
}

output "origin_secret" {
  description = "Value of the x-origin-secret header, for Cloudflare's transform rule."
  value       = random_password.origin_secret.result
  sensitive   = true
}
