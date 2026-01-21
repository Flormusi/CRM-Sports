export interface Order {
  id: string;
  customer: {
    id: string;
    name: string;
  };
  items: OrderItem[];
  status: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}