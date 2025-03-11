import express, { Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { analyzeTokenRisk } from './priceAnalysis';
import { sendTransaction } from './walletService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const RECIPIENT_WALLET = '0x486BEa6B90243d2Ff3EE2723a47605C3361c3d95';

// Define interfaces for type safety
interface PriceResponse {
  [tokenId: string]: {
    usd: number;
  };
}

interface ApiResponse {
  success: boolean;
  price?: number;
  currency?: string;
  token_id?: string;
  timestamp?: string;
  message?: string;
  error?: string;
  analysis?: any;
}

interface InvestmentRequest {
  amount: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Endpoint to fetch Sonic token price
app.get('/api/fetchsonicprice', async (req: Request, res: Response): Promise<any> => {
  try {
    // Define the token ID
    const tokenId: string = 'sonic-3';
    
    // Make the request to CoinGecko API
    const response = await axios.get<PriceResponse>('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: tokenId,
        vs_currencies: 'usd'
      }
    });

    // Log the raw response for debugging
    console.log('API Response:', JSON.stringify(response.data, null, 2));
    
    // Extract the price data using the correct token ID
    const sonicPrice: number = response.data[tokenId].usd;
    
    return res.status(200).json({
      success: true,
      price: sonicPrice,
      currency: 'USD',
      token_id: tokenId,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    // Safe error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching Sonic price:', errorMessage);
    
    // Handle response data logging safely
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: unknown } };
      console.error('Error details:', axiosError.response?.data || 'No response data');
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Sonic token price',
      error: errorMessage
    } as ApiResponse);
  }
});

// Endpoint to analyze token and get investment recommendation
app.get('/api/analyze', async (req: Request, res: Response): Promise<any> => {
  try {
    const tokenId: string = 'sonic-3'; // Define the token ID
    const analysis = await analyzeTokenRisk(tokenId);
    console.log('Analysis result:', analysis);
    
    // Make sure we have both priceDropFactor and priceDrop values
    // The analyzeTokenRisk function should already include these in the result
    
    return res.status(200).json({
      success: true,
      token_id: tokenId,
      analysis: {
        ...analysis,
        // If priceDrop isn't directly returned from analyzeTokenRisk but is calculated within it,
        // you can add it here if needed
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error analyzing token:', errorMessage);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze token',
      error: errorMessage
    });
  }
});

// Endpoint to process investment
app.post('/api/invest', async (req: Request, res: Response): Promise<any> => {
  try {
    const { amount, riskLevel }: InvestmentRequest = req.body;
    
    if (!amount || !riskLevel) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount and riskLevel'
      });
    }
    
    // Get current token price
    const priceResponse = await axios.get<ApiResponse>('http://localhost:' + PORT + '/api/fetchsonicprice');
    const tokenPrice = priceResponse.data.price;
    
    if (!tokenPrice) {
      throw new Error('Failed to get current token price');
    }
    
    // Send transaction
    const txHash = await sendTransaction({
      amount,
      tokenPrice,
      walletAddress: RECIPIENT_WALLET,
      riskLevel
    });
    
    return res.status(200).json({
      success: true,
      message: `Successfully invested $${amount} at ${riskLevel} risk level`,
      transactionHash: txHash,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error processing investment:', errorMessage);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to process investment',
      error: errorMessage
    });
  }
});

// Root endpoint - serve the frontend
app.get('/', (req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the app at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down gracefully.');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received. Shutting down gracefully.');
  server.close(() => {
    process.exit(0);
  });
});

export default app;