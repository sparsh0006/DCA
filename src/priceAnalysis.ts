import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PriceData {
  date: string;
  price: number;
}

interface AnalysisResult {
  movingAverage: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  suggestedInvestment: number;
  priceDropFactor: number;
  priceDrop: number; // Added this field to explicitly return the price drop percentage
}

export async function fetchHistoricalPrices(tokenId: string, days: number = 30): Promise<PriceData[]> {
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days: days,
      },
    });

    // CoinGecko returns prices as [timestamp, price] arrays
    const data = response.data as { prices: [number, number][] };
    return data.prices.map((item: [number, number]) => ({
      date: new Date(item[0]).toISOString(),
      price: item[1],
    }));
  } catch (error) {
    console.error('Error fetching historical prices:', error);
    throw new Error('Failed to fetch historical prices');
  }
}

export function calculateMovingAverage(prices: PriceData[], period: number = 7): number {
  if (prices.length < period) {
    throw new Error('Not enough price data to calculate moving average');
  }

  const recentPrices = prices.slice(-period);
  const sum = recentPrices.reduce((acc, data) => acc + data.price, 0);
  return sum / period;
}

// Updated function to calculate price drop percentage using last day price
export function calculatePriceDrop(prices: PriceData[], period: number = 1): number {
  if (prices.length < 2) {
    throw new Error('Not enough price data to calculate price drop');
  }

  // Group data points by day to find the last day's price
  const dateMap = new Map<string, PriceData[]>();
  
  // Group all price points by their calendar day (in UTC)
  prices.forEach(priceData => {
    const date = new Date(priceData.date);
    const dayKey = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
    
    if (!dateMap.has(dayKey)) {
      dateMap.set(dayKey, []);
    }
    dateMap.get(dayKey)!.push(priceData);
  });
  
  // Convert the map to an array and sort by date
  const groupedByDay = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));
  
  // Need at least 2 days of data
  if (groupedByDay.length < 2) {
    throw new Error('Not enough days of price data to calculate day-over-day change');
  }
  
  // Get the last full day's last price (previous day)
  const previousDayData = groupedByDay[groupedByDay.length - 2][1];
  const oldPrice = previousDayData[previousDayData.length - 1].price; // Last price of previous day
  const oldPriceDate = previousDayData[previousDayData.length - 1].date;
  
  // Get the current day's latest price
  const currentDayData = groupedByDay[groupedByDay.length - 1][1];
  const currentPrice = currentDayData[currentDayData.length - 1].price; // Latest price of current day
  const currentPriceDate = currentDayData[currentDayData.length - 1].date;
  
  // Calculate percentage change - ensure we're capturing drops (positive values) and rises (negative values)
  const percentageChange = ((oldPrice - currentPrice) / oldPrice) * 100;
  
  // Extended debug logging to check values and timestamps
  console.log(`Old price (last day): ${oldPrice} at ${oldPriceDate}`);
  console.log(`Current price (today): ${currentPrice} at ${currentPriceDate}`);
  console.log(`Percentage change: ${percentageChange.toFixed(2)}%`);
  
  return percentageChange;
}

// Modified function to generate priceDropFactor based on new requirements
export function getPriceDropFactor(priceDrop: number): number {
  let min: number, max: number;
  
  // Handle price increases (negative priceDrop values)
  if (priceDrop < 0) {
    // Convert negative price drop to positive price increase percentage
    const priceIncrease = Math.abs(priceDrop);
    
    if (priceIncrease <= 3) {
      // 0-3% increase: priceDropFactor between 1.0 and 1.3
      min = 1.0;
      max = 1.3;
    } else if (priceIncrease <= 10) {
      // 4-10% increase: priceDropFactor between 1.4 and 1.7
      min = 1.4;
      max = 1.7;
    } else {
      // Beyond 10% increase: priceDropFactor between 1.8 and 1.9
      min = 1.8;
      max = 1.9;
    }
  } 
  // Handle price drops (positive priceDrop values)
  else {
    if (priceDrop <= 3) {
      // 0-3% drop: priceDropFactor between 0.7 and 1.0
      min = 0.7;
      max = 1.0;
    } else if (priceDrop <= 10) {
      // 4-10% drop: priceDropFactor between 0.3 and 0.6
      min = 0.3;
      max = 0.6;
    } else {
      // Beyond 10% drop: priceDropFactor between 0.0 and 0.2
      min = 0.0;
      max = 0.2;
    }
  }
  
  // Generate random number with 2 decimal place precision
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

export async function analyzeTokenRisk(tokenId: string): Promise<AnalysisResult> {
  try {
    // Fetch historical price data
    const priceData = await fetchHistoricalPrices(tokenId);
    
    // Calculate 7-day moving average
    const movingAverage7Day = calculateMovingAverage(priceData, 7);
    
    // Calculate 30-day moving average
    const movingAverage30Day = calculateMovingAverage(priceData, 30);
    
    // Calculate volatility (standard deviation of price changes)
    const priceChanges = [];
    for (let i = 1; i < priceData.length; i++) {
      const percentChange = ((priceData[i].price - priceData[i-1].price) / priceData[i-1].price) * 100;
      priceChanges.push(percentChange);
    }
    
    const average = priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length;
    
    const variance = priceChanges.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / priceChanges.length;
    
    const volatility = Math.sqrt(variance);
    
    // Current price
    const currentPrice = priceData[priceData.length - 1].price;
    
    // Calculate 1-day price drop percentage
    const priceDrop = calculatePriceDrop(priceData);
    
    // Generate random factor based on price drop
    const priceDropFactor = getPriceDropFactor(priceDrop);
    
    // Use OpenAI to analyze and provide recommendations
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a cryptocurrency investment analyst. Analyze the provided data and suggest an investment risk level (low, medium, or high) based on the data. Every time user refresh give answer with different tone."
        },
        {
          role: "user",
          content: `
          Please analyze this token data and provide an investment recommendation:
          
          Token: ${tokenId}
          Current Price: $${currentPrice}
          7-Day Moving Average: $${movingAverage7Day}
          30-Day Moving Average: $${movingAverage30Day}
          Volatility (Std Dev of Daily % Change): ${volatility.toFixed(2)}%
          1-Day Price Drop: ${priceDrop.toFixed(2)}%
          Price Drop Factor: ${priceDropFactor}
          
          Classify the risk as:
          - Low Risk (suggest $10 investment) if volatility is low and price is stable or gradually increasing
          - Medium Risk (suggest $20 investment) if there's moderate volatility or unclear trend
          - High Risk (suggest $30 investment) if there's high volatility or sharp price movements
          
          Format your response as JSON with fields: riskLevel (low, medium, or high), recommendation (brief explanation), suggestedInvestment (dollar amount)
          `
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the JSON response
    if (!completion.choices[0].message.content) {
      throw new Error('OpenAI response content is null');
    }
    const analysis = JSON.parse(completion.choices[0].message.content);
    console.log
    
    return {
      movingAverage: movingAverage7Day,
      riskLevel: analysis.riskLevel,
      recommendation: analysis.recommendation,
      suggestedInvestment: analysis.suggestedInvestment,
      priceDropFactor: priceDropFactor,
      priceDrop: priceDrop // Explicitly include the price drop percentage in the result
    };
  } catch (error) {
    console.error('Error analyzing token risk:', error);
    // Default to medium risk if analysis fails, with a default priceDropFactor of 1.5
    return {
      movingAverage: 0,
      riskLevel: 'medium',
      recommendation: 'Analysis failed. Consider standard diversification approaches.',
      suggestedInvestment: 20,
      priceDropFactor: 0.5, // Updated default to match new scale
      priceDrop: 0 // Default price drop
    };
  }
}