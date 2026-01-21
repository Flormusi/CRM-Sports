@echo off
mkdir "C:\Program Files\CRM Sports\ssl\certs"
mkdir "C:\Program Files\CRM Sports\ssl\private"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "C:\Program Files\CRM Sports\ssl\private\crm-sports.key" -out "C:\Program Files\CRM Sports\ssl\certs\crm-sports.crt"