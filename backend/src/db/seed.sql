-- Insert test customers
INSERT INTO customers (first_name, last_name, email, phone) VALUES
    ('John', 'Doe', 'john@example.com', '+1234567890'),
    ('Jane', 'Smith', 'jane@example.com', '+1987654321'),
    ('Mike', 'Johnson', 'mike@example.com', '+1122334455');

-- Insert test products
INSERT INTO products (name, description, price, stock, min_stock, category) VALUES
    ('Soccer Ball', 'Professional match ball', 29.99, 50, 10, 'Soccer'),
    ('Basketball', 'Indoor/Outdoor', 24.99, 40, 8, 'Basketball'),
    ('Tennis Racket', 'Professional grade', 89.99, 20, 5, 'Tennis');

-- Insert test orders
INSERT INTO orders (customer_id, total, status) VALUES
    (1, 29.99, 'completed'),
    (2, 114.98, 'pending'),
    (3, 24.99, 'processing');

-- Insert test order items
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
    (1, 1, 1, 29.99),
    (2, 1, 1, 29.99),
    (2, 3, 1, 84.99),
    (3, 2, 1, 24.99);