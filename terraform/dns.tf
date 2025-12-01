data "digitalocean_domain" "lumina" {
  name = var.domain
}

resource "digitalocean_record" "repos" {
  domain = data.digitalocean_domain.lumina.id
  type   = "A"
  name   = "repos"
  value  = var.droplet_ip
  ttl    = 300
}
