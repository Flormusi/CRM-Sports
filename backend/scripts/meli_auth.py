import requests
import webbrowser
from fastapi import FastAPI
import uvicorn
from pathlib import Path
import json
from datetime import datetime

app = FastAPI()
env_path = Path(__file__).parent.parent / '.env'

@app.get("/api/meli/callback")
async def meli_callback(code: str = None):
    if not code:
        return {
            "error": "Authorization code is missing",
            "message": "Please make sure you complete the authentication process in Mercado Libre"
        }
    
    try:
        response = requests.post(
            "https://api.mercadolibre.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": app.meli_client_id,
                "client_secret": app.meli_client_secret,
                "code": code,
                "redirect_uri": "http://localhost:8000/api/meli/callback"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Update .env file with new tokens
            with open(env_path, 'r') as file:
                env_content = file.read()
            
            # Replace or add tokens
            env_content = update_env_var(env_content, "MELI_ACCESS_TOKEN", data['access_token'])
            env_content = update_env_var(env_content, "MELI_REFRESH_TOKEN", data['refresh_token'])
            
            with open(env_path, 'w') as file:
                file.write(env_content)
            
            return {
                "message": "Authentication successful! Tokens have been saved to .env file.",
                "access_token": data['access_token'],
                "refresh_token": data['refresh_token']
            }
        
        return {"error": f"Authentication failed: {response.text}"}
    
    except Exception as e:
        return {"error": f"Error during authentication: {str(e)}"}

def update_env_var(content: str, var_name: str, new_value: str) -> str:
    if var_name in content:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith(f"{var_name}="):
                lines[i] = f"{var_name}={new_value}"
                break
        return '\n'.join(lines)
    else:
        return f"{content}\n{var_name}={new_value}"

def main():
    try:
        print("\nChecking MeLi developer status...")
        print("⚠️  Your developer account is pending verification.")
        print("Please wait for the verification email from Mercado Libre (approximately 36 hours).")
        print("Once verified, run this script again to complete the authentication process.\n")
        
        proceed = input("Do you want to try authentication anyway? (y/N): ")
        if proceed.lower() != 'y':
            return

        # Read client credentials
        with open(env_path, 'r') as file:
            for line in file:
                if line.startswith('MELI_CLIENT_ID='):
                    app.meli_client_id = line.split('=')[1].strip()
                elif line.startswith('MELI_CLIENT_SECRET='):
                    app.meli_client_secret = line.split('=')[1].strip()
        
        if not hasattr(app, 'meli_client_id') or not hasattr(app, 'meli_client_secret'):
            raise ValueError("MELI_CLIENT_ID and MELI_CLIENT_SECRET must be set in .env file")

        auth_url = (
            "https://auth.mercadolibre.com.ar/authorization"
            f"?response_type=code"
            f"&client_id={app.meli_client_id}"
            f"&redirect_uri=http://localhost:8000/api/meli/callback"
        )
        
        print("\nOpening browser for MeLi authentication...")
        print(f"Auth URL: {auth_url}\n")
        webbrowser.open(auth_url)
        
        uvicorn.run(app, host="localhost", port=8000)
    
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()