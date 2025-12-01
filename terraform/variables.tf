variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Root domain"
  type        = string
  default     = "lumina.study"
}

variable "droplet_ip" {
  description = "IP address of the Lumina droplet"
  type        = string
}
