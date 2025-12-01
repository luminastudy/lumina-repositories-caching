output "service_url" {
  description = "URL of the repositories caching service"
  value       = "https://repos.${var.domain}"
}

output "dns_record" {
  description = "DNS record created"
  value       = "repos.${var.domain} -> ${var.droplet_ip}"
}

output "deployment_instructions" {
  description = "Steps to deploy the service"
  value       = <<-EOF

    Deployment Steps:
    1. SSH to droplet: ssh root@${var.droplet_ip}
    2. Create directory: mkdir -p /opt/lumina/repositories-caching
    3. Clone repo: cd /opt/lumina/repositories-caching && git clone https://github.com/luminastudy/lumina-repositories-caching.git .
    4. Copy Caddy config: cp caddy/repos.conf /opt/lumina/caddy/conf.d/
    5. Reload Caddy: docker exec caddy caddy reload --config /etc/caddy/Caddyfile
    6. Start service: docker-compose up -d --build
    7. Verify: curl https://repos.${var.domain}/trpc
  EOF
}
