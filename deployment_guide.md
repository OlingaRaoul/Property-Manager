# DigitalOcean Droplet Deployment Guide — Property Manager Pro

This guide outlines how to configure, run, and secure **Property Manager Pro** on a DigitalOcean Droplet using the Docker Compose setup.

---

## Step 1: Install Docker & Docker Compose (If not installed)

On your DigitalOcean droplet, the most reliable and automated way to install Docker (including the Compose plugin) is to use the official Docker installer script. Run the following commands:

```bash
# Remove any broken manually-added Docker apt sources
sudo rm -f /etc/apt/sources.list.d/docker.list

# Download and run the official Docker installation script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify installations
sudo docker --version
sudo docker compose version
```

---

## Step 2: Configure Environment Variables

Create a production `.env` file in the project root on the server (or customize the `environment` section in `docker-compose.yml` directly) to change default credentials and secure the system.

1. Create the `.env` file:
   ```bash
   nano .env
   ```
2. Add your production variables (e.g., custom secrets):
   ```env
   JWT_SECRET=your_long_random_secure_secret_string_here
   MONGODB_URI=mongodb://mongodb:27017/property_manager
   PORT=3000
   ```

*(Note: Docker Compose automatically detects a `.env` file in the same directory and interpolates values, but since our current `docker-compose.yml` has hardcoded env fallbacks, you can also modify `docker-compose.yml` directly if preferred).*

---

## Step 3: Run the Application

From the project root directory where `docker-compose.yml` is located, execute the build and run command:

```bash
sudo docker compose up -d --build
```

### Verify running containers:
```bash
sudo docker compose ps
```
The application should now be accessible over the HTTP port at your droplet's public IP address: `http://YOUR_DROPLET_IP/`.

---

## Step 4: Configure Domain and SSL (Recommended)

To run the application under a custom domain (e.g. `app.yourdomain.com`) with automated SSL (HTTPS) certificates, the cleanest approach is to use a **Host-level Reverse Proxy** (Nginx + Certbot) on the droplet.

### 1. Re-map Docker Frontend Port
To avoid port conflicts on port `80`, map the Nginx container to an internal port like `8080` in your `docker-compose.yml`:

Modify the `frontend` section ports block:
```yaml
  frontend:
    # ...
    ports:
      - "8080:80"
```
Re-run compose:
```bash
sudo docker compose up -d
```

### 2. Install Nginx and Certbot on Droplet Host
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 3. Create Host Nginx Server Block
Create a config file for your domain:
```bash
sudo nano /etc/nginx/sites-available/property_manager
```
Paste the configuration mapping incoming traffic to the docker container on port `8080`:
```nginx
server {
    listen 80;
    server_name app.yourdomain.com; # Replace with your domain

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/property_manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Obtain Let's Encrypt SSL Certificate
Run Certbot to generate the SSL certificate and automatically update the Nginx configuration:
```bash
sudo certbot --nginx -d app.yourdomain.com
```
Follow the interactive prompts to enable redirecting HTTP to HTTPS. Your app will now be secure at `https://app.yourdomain.com/`.
