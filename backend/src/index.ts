import dotenv from 'dotenv';
dotenv.config();
import { app } from './app';

// Add basic error handling for uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for testing
export { app };
