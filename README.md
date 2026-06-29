### JWT_SECRET หาได้จาก รัน key บน terminal
```
openssl rand -base64 32
```

### setup Caddy
```
root@your-server:/etc/caddy# cat Caddyfile 
webhook.com {
    handle /webhook/* {
        reverse_proxy localhost:3102
    }
    handle /api/v1/* {
        reverse_proxy localhost:3102
    }
    handle {
        reverse_proxy localhost:3101
    }
}
```
