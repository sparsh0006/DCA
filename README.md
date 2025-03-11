## Project: Crypto Token Risk Analyzer 🚀

### Features
- Fetches historical price data
- Calculates moving averages and price drop percentages
- Evaluates volatility and investment risk levels
- Provides AI-generated investment recommendations

### Setup
1. Clone the repository
2. Install dependencies: `npm install axios openai dotenv`
3. Set up environment variables in a `.env` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   ```
4. Run the analysis function:
   ```typescript
   analyzeTokenRisk('bitcoin').then(console.log);
   ```

## License
MIT

