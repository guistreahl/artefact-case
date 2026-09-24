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

  # The bucket is created before the first `terraform init`, together with the
  # project. Versioning is on: a corrupted state rolls back to the previous
  # version. The prefix keeps its original name so the state is not lost.
  backend "gcs" {
    bucket = "case-artefact-guistreahl-tfstate"
    prefix = "tarefas"
  }
}

provider "google" {
  project = var.project
  region  = var.region
}
