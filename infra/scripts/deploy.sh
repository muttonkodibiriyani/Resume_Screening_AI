#!/usr/bin/env bash
# Deploy Alshaya AI Recruit infrastructure + container image to Azure.
#
# Usage:
#   ./deploy.sh dev
#   ./deploy.sh prod
#
# Requires: az CLI logged in, az account set to target subscription, Docker, ACR Login,
# and an existing resource group `rg-alshaya-recruit-<env>`.

set -euo pipefail

ENV=${1:-dev}
PARAM_FILE="infra/azure/parameters.${ENV}.json"
RG="rg-alshaya-recruit-${ENV}"
LOC="uaenorth"

if [[ ! -f "$PARAM_FILE" ]]; then
  echo "Missing parameter file: $PARAM_FILE" >&2
  exit 1
fi

if ! az group show --name "$RG" >/dev/null 2>&1; then
  echo "Creating resource group $RG in $LOC ..."
  az group create --name "$RG" --location "$LOC" --tags env="$ENV" app=alshaya-ai-recruit >/dev/null
fi

ACR_NAME=$(jq -r '.parameters.containerImage.value' "$PARAM_FILE" | cut -d. -f1)
IMAGE=$(jq -r '.parameters.containerImage.value' "$PARAM_FILE")
TAG=$(echo "$IMAGE" | awk -F: '{print $NF}')

echo "Logging into ACR $ACR_NAME ..."
az acr login --name "$ACR_NAME"

echo "Building image $IMAGE ..."
docker build -f infra/Dockerfile -t "$IMAGE" --build-arg DATABASE_PROVIDER=postgresql .
docker push "$IMAGE"

echo "Deploying Bicep to $RG ..."
az deployment group create \
  --resource-group "$RG" \
  --template-file infra/azure/main.bicep \
  --parameters "@${PARAM_FILE}" \
  --parameters containerImage="$IMAGE"

echo "Done. Front Door endpoint:"
az deployment group show -g "$RG" -n main --query "properties.outputs.frontDoorEndpoint.value" -o tsv
