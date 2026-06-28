# GitHub Actions Deployment Guide

This document explains how to set up and use the automated CI/CD pipeline for PODS Simulation.

## Automatic Workflow

The CI/CD pipeline is defined in `.github/workflows/ci-cd.yml` and automatically runs on:
- **Push to `main` or `develop` branch**
- **Pull requests** to these branches

## Workflow Stages

### 1. Test Stage
Runs on every push/PR:
- Install dependencies
- Lint code
- Build backend
- Build frontend
- Run tests

**Status**: Check "Actions" tab in your GitHub repository

### 2. Build Stage
Runs after tests pass on main/develop:
- Build Docker image
- Push to GitHub Container Registry (ghcr.io)
- Tag with branch name, version, and commit SHA

**Container Image**: `ghcr.io/<your-username>/pods-simulation:<tag>`

### 3. Deploy Stage
Runs after build on main branch only:
- Notification that deployment is ready
- You can pull and deploy the image

## Setup Instructions

### 1. Enable GitHub Actions

1. Go to your GitHub repository
2. Click "Settings" → "Actions" → "General"
3. Ensure "Allow all actions and reusable workflows" is selected
4. Click "Save"

### 2. Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name: `pods-simulation-ci`
4. Select scopes:
   - `write:packages` (to push Docker images)
   - `read:packages` (to read Docker images)
5. Click "Generate token"
6. Copy the token (you won't see it again!)

### 3. Add Secrets to Repository

1. Go to your GitHub repository
2. Click "Settings" → "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Add these secrets:

   - **Name**: `REGISTRY_PAT`
     **Value**: [Your GitHub Personal Access Token from step 2]

5. Leave other secrets empty (Docker credentials optional)

### 4. Push Your Code

```bash
git add .
git commit -m "Initial commit: PODS simulation project"
git push origin main
```

GitHub Actions will automatically:
1. Run tests
2. Build Docker image
3. Push to ghcr.io
4. Notify completion

## Monitoring Builds

1. Go to your GitHub repository
2. Click "Actions" tab
3. View workflow runs with status (✓ passed, ✗ failed)
4. Click on a run to see detailed logs

## Deploying the Application

### Option A: Docker (Recommended)

```bash
# Pull the latest image
docker pull ghcr.io/<your-username>/pods-simulation:main

# Run the container
docker run -p 3000:3000 ghcr.io/<your-username>/pods-simulation:main
```

### Option B: Kubernetes (Advanced)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pods-simulation
spec:
  replicas: 2
  selector:
    matchLabels:
      app: pods-simulation
  template:
    metadata:
      labels:
        app: pods-simulation
    spec:
      containers:
      - name: pods-simulation
        image: ghcr.io/<your-username>/pods-simulation:main
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
```

## Environment Variables

The Docker image includes:
- `NODE_ENV=production`
- `PORT=3000`
- `REACT_APP_API_URL=/api` (frontend proxies to backend)

To override in Docker:
```bash
docker run -e NODE_ENV=production -p 3000:3000 ghcr.io/<your-username>/pods-simulation:main
```

## Troubleshooting

### Tests failing
1. Check "Actions" → Failed workflow
2. View logs to see error
3. Fix code locally: `npm test`
4. Commit and push fix

### Docker build failing
1. Check workflow logs
2. Common issues:
   - Node.js version mismatch
   - Missing dependencies
   - Port conflicts

### Image not pushing to registry
1. Verify REGISTRY_PAT secret is set correctly
2. Check token hasn't expired
3. Ensure token has `write:packages` scope

## Manual Workflow Triggers

To manually trigger the CI/CD pipeline:

1. Go to "Actions" → "CI/CD Pipeline"
2. Click "Run workflow"
3. Select branch and click "Run workflow"

## Customizing the Pipeline

Edit `.github/workflows/ci-cd.yml` to:
- Add new test commands
- Change deployment target
- Add additional steps
- Modify container registry

## Security Best Practices

✓ **Do**:
- Use GitHub Secrets for sensitive data
- Restrict branch protection rules
- Regular token rotation
- Use specific version tags for dependencies

✗ **Don't**:
- Commit `.env` files with secrets
- Use plaintext credentials
- Share personal access tokens
- Hardcode API keys in code

## Support

For CI/CD issues:
1. Check GitHub Actions logs
2. Review `.github/workflows/ci-cd.yml`
3. Test locally: `npm run build && npm test`
4. Open GitHub issue with detailed logs

---

**Last Updated**: June 2026  
**Pipeline Version**: 1.0.0
