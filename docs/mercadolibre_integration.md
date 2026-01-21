# Mercado Libre Integration Documentation

## Overview
This integration allows automatic synchronization between the CRM Sports system and Mercado Libre marketplace, enabling real-time product updates and inventory management.

## Setup Process

### 1. Developer Account Setup
1. Register as a Mercado Libre developer at https://developers.mercadolibre.com.ar/
2. Complete identity verification (takes approximately 36 hours)
3. Create a new application in the developer dashboard

### 2. Configuration
Once your developer account is verified:

1. Get your API credentials from the Mercado Libre developer dashboard
2. Update your `.env` file with:

### 3. Authentication
Run the authentication script:
```bash
python backend/scripts/meli_auth.py