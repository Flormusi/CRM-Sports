import axios from 'axios';
import { ApiError } from '../utils/ApiError';

export class MeliService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    const refreshToken = process.env.MELI_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new ApiError(500, 'MELI_REFRESH_TOKEN is not configured');
    }
    this.refreshToken = refreshToken;
  }

  private async refreshAccessToken() {
    try {
      const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'refresh_token',
        client_id: process.env.MELI_CLIENT_ID,
        client_secret: process.env.MELI_CLIENT_SECRET,
        refresh_token: this.refreshToken
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
    } catch (error) {
      throw new ApiError(401, 'Failed to refresh MercadoLibre access token');
    }
  }

  async getItemStock(itemId: string): Promise<number> {
    if (!this.accessToken) {
      await this.refreshAccessToken();
    }

    try {
      const response = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      return response.data.available_quantity;
    } catch (error) {
      throw new ApiError(500, 'Failed to fetch item stock from MercadoLibre');
    }
  }

  async getItemPrice(itemId: string): Promise<number> {
    if (!this.accessToken) {
      await this.refreshAccessToken();
    }

    try {
      const response = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      return response.data.price;
    } catch (error) {
      throw new ApiError(500, 'Failed to fetch item price from MercadoLibre');
    }
  }

  async updateItemStock(itemId: string, quantity: number): Promise<void> {
    if (!this.accessToken) {
      await this.refreshAccessToken();
    }

    try {
      await axios.put(
        `https://api.mercadolibre.com/items/${itemId}`,
        { available_quantity: quantity },
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
    } catch (error) {
      throw new ApiError(500, 'Failed to update item stock in MercadoLibre');
    }
  }

  async updateItemPrice(itemId: string, price: number): Promise<void> {
    if (!this.accessToken) {
      await this.refreshAccessToken();
    }

    try {
      await axios.put(
        `https://api.mercadolibre.com/items/${itemId}`,
        { price },
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
    } catch (error) {
      throw new ApiError(500, 'Failed to update item price in MercadoLibre');
    }
  }

  async syncProduct(itemId: string): Promise<{ stock: number; price: number }> {
    if (!this.accessToken) {
      await this.refreshAccessToken();
    }

    try {
      const response = await axios.get(`https://api.mercadolibre.com/items/${itemId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      return {
        stock: response.data.available_quantity,
        price: response.data.price
      };
    } catch (error) {
      throw new ApiError(500, 'Failed to sync product with MercadoLibre');
    }
  }
}