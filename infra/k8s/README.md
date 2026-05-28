# Kubernetes alternative

The Bicep flow targets Azure App Service Containers. If you instead want to run on
AKS (or any conformant Kubernetes), this folder provides the equivalent manifests:

```sh
# 1. Replace placeholder image + secret values
kubectl apply -f namespace.yaml
kubectl apply -f deployment.yaml

# 2. Wait for the pod
kubectl -n alshaya-recruit get pods -w

# 3. Tail the logs
kubectl -n alshaya-recruit logs deploy/alshaya-recruit -f
```

For production AKS we recommend:

- Replacing the inline Secret with **Azure Key Vault CSI driver** (`SecretProviderClass`).
- Replacing the PVC `uploads` with **Azure Files (premium)** or fully switching to Azure Blob via `STORAGE_PROVIDER=azure-blob`.
- Adding `azure-workload-identity` annotations so the pod federates with the same Managed Identity used by the Bicep flow.
