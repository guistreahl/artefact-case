terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # O bucket é criado antes do primeiro `terraform init`, junto com o projeto.
  # Tem versionamento ligado: um estado corrompido volta para a versão anterior.
  backend "gcs" {
    bucket = "case-artefact-guistreahl-tfstate"
    prefix = "tarefas"
  }
}

provider "google" {
  project = var.projeto
  region  = var.regiao
}
