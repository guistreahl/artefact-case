variable "projeto" {
  description = "ID do projeto no Google Cloud. O projeto e o faturamento são criados fora do Terraform."
  type        = string
  default     = "case-artefact-guistreahl"
}

variable "regiao" {
  type    = string
  default = "us-central1"
}

variable "repositorio_github" {
  description = "Único repositório autorizado a publicar, no formato dono/nome."
  type        = string
  default     = "guistreahl/case-artefact"
}

variable "dominio" {
  type    = string
  default = "gerenciador.guistreahl.com.br"
}
