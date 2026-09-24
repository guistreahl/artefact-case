# Os três primeiros vão em Variables do GitHub (Settings, Secrets and
# variables, Actions). Sozinhos, não dão acesso a nada.

output "GCP_PROJETO" {
  value = var.projeto
}

output "GCP_WORKLOAD_IDENTITY_PROVIDER" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "GCP_SERVICE_ACCOUNT" {
  value = google_service_account.deploy.email
}

output "registros_dns" {
  description = "O que criar no DNS para o domínio apontar para o Cloud Run."
  value       = google_cloud_run_domain_mapping.tarefas.status[0].resource_records
}
