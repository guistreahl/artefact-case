variable "project" {
  description = "Google Cloud project ID. The project and its billing are created outside Terraform."
  type        = string
  default     = "case-artefact-guistreahl"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "github_repository" {
  description = "The only repository allowed to deploy, as owner/name."
  type        = string
  default     = "guistreahl/artefact-case"
}

variable "domain" {
  type    = string
  default = "gerenciador.guistreahl.com.br"
}
