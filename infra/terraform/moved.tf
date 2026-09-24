# Terraform names were translated from Portuguese to English. These blocks tell
# Terraform the resources were renamed, not replaced: nothing is destroyed or
# recreated in Google Cloud.

moved {
  from = google_artifact_registry_repository.servicos
  to   = google_artifact_registry_repository.images
}

moved {
  from = google_service_account.tarefas_run
  to   = google_service_account.runtime
}

moved {
  from = google_artifact_registry_repository_iam_member.deploy_publica_imagens
  to   = google_artifact_registry_repository_iam_member.deploy_pushes_images
}

moved {
  from = google_project_iam_member.deploy_publica_revisoes
  to   = google_project_iam_member.deploy_publishes_revisions
}

moved {
  from = google_service_account_iam_member.deploy_usa_tarefas_run
  to   = google_service_account_iam_member.deploy_acts_as_runtime
}

moved {
  from = random_password.segredo_origem
  to   = random_password.origin_secret
}

moved {
  from = google_secret_manager_secret.segredo_origem
  to   = google_secret_manager_secret.origin_secret
}

moved {
  from = google_secret_manager_secret_version.segredo_origem
  to   = google_secret_manager_secret_version.origin_secret
}

moved {
  from = google_secret_manager_secret_iam_member.leitores_segredo_origem
  to   = google_secret_manager_secret_iam_member.origin_secret_readers
}

moved {
  from = google_service_account_iam_member.github_age_como_deploy
  to   = google_service_account_iam_member.github_acts_as_deploy
}

moved {
  from = google_cloud_run_v2_service.tarefas
  to   = google_cloud_run_v2_service.app
}

moved {
  from = google_cloud_run_v2_service_iam_member.acesso_publico
  to   = google_cloud_run_v2_service_iam_member.public_access
}

moved {
  from = google_cloud_run_domain_mapping.tarefas
  to   = google_cloud_run_domain_mapping.domain
}
