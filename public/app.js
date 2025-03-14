// Call init to start the application
document.addEventListener('DOMContentLoaded', init);
// DOM Elements
const currentPriceElement = document.getElementById('current-price');
const refreshButton = document.getElementById('refresh-btn');
const analysisContent = document.getElementById('analysis-content');
const movingAverageElement = document.getElementById('moving-average');
const priceDropElement = document.getElementById('price-drop-info');
const investButtons = document.querySelectorAll('.invest-btn');
const transactionContainer = document.getElementById('transaction-container');
const transactionStatus = document.getElementById('transaction-status');
const txModal = new bootstrap.Modal(document.getElementById('txModal'));
const modalMessage = document.getElementById('modal-message');

// API Endpoints
const API = {
  PRICE: '/api/fetchsonicprice',
  ANALYSIS: '/api/analyze',
  INVEST: '/api/invest'
};

// Global state
let currentPrice = 0;
let currentAnalysis = null;

// Initialize the app
async function init() {
  await fetchPrice();
  await fetchAnalysis();
  setupEventListeners();
}

// Fetch current token price
async function fetchPrice() {
  try {
    const response = await fetch(API.PRICE);
    const data = await response.json();
    
    if (data.success && data.price) {
      currentPrice = data.price;
      currentPriceElement.textContent = `$${data.price.toFixed(4)} USD`;
    } else {
      throw new Error(data.message || 'Failed to fetch price');
    }
  } catch (error) {
    console.error('Error fetching price:', error);
    currentPriceElement.textContent = 'Error loading price';
    currentPriceElement.classList.add('text-danger');
  }
}

// Fetch token analysis and recommendations
// Updated code snippet for app.js to properly display price drops
// This ensures negative values (price increases) are shown correctly

// In the fetchAnalysis function, update the part that handles the price drop display:

async function fetchAnalysis() {
  try {
    // Show loading state
    analysisContent.innerHTML = `
      <p class="text-center">
        <span class="spinner-border text-primary" role="status"></span><br>
        Analyzing market conditions...
      </p>
    `;
    
    const response = await fetch(API.ANALYSIS);
    const data = await response.json();
    
    if (data.success && data.analysis) {
      currentAnalysis = data.analysis;
      
      // Update the analysis content
      analysisContent.innerHTML = `
        <div class="alert alert-${getRiskAlertClass(data.analysis.riskLevel)}" role="alert">
          <h5 class="alert-heading">Risk Level: ${capitalizeFirstLetter(data.analysis.riskLevel)}</h5>
          <p>${data.analysis.recommendation}</p>
          <hr>
          <p class="mb-0">Suggested Investment: $${data.analysis.suggestedInvestment}</p>
        </div>
      `;
      
      // Update moving average display
      movingAverageElement.textContent = `7-Day Moving Average: $${data.analysis.movingAverage.toFixed(4)}`;
      
      // Update price drop information if available
      if (data.analysis.hasOwnProperty('priceDropFactor')) {
        // Get the price drop value (could be positive for drops or negative for rises)
        const priceDrop = data.analysis.priceDrop;
        
        // Determine text and styling based on whether it's a drop or rise
        let priceChangeText, priceChangeClass, iconHTML;
        
        if (priceDrop > 0) {
          // It's a price drop (positive value)
          priceChangeText = `${priceDrop.toFixed(2)}% ↓`;
          priceChangeClass = getPriceDropClass(data.analysis.priceDropFactor);
          iconHTML = '<i class="bi bi-arrow-down"></i>';
        } else {
          // It's a price rise (negative value)
          priceChangeText = `${Math.abs(priceDrop).toFixed(2)}% ↑`;
          priceChangeClass = 'text-success';
          iconHTML = '<i class="bi bi-arrow-up"></i>';
        }
        
        priceDropElement.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <span>1-Day Price Change: <strong class="${priceChangeClass}">${priceChangeText}</strong></span>
            <span>Price Drop Factor: <strong class="${getPriceDropClass(data.analysis.priceDropFactor)}">${data.analysis.priceDropFactor.toFixed(1)}</strong></span>
          </div>
        `;
        priceDropElement.classList.remove('d-none');
      } else {
        priceDropElement.classList.add('d-none');
      }
      
      // Highlight the recommended option
      highlightRecommendedOption(data.analysis.riskLevel);
    } else {
      throw new Error(data.message || 'Failed to analyze token');
    }
  } catch (error) {
    console.error('Error fetching analysis:', error);
    analysisContent.innerHTML = `
      <div class="alert alert-warning" role="alert">
        <p>Unable to generate investment analysis. Using default medium risk profile.</p>
      </div>
    `;
    priceDropElement.classList.add('d-none');
  }
}

// Helper function to determine the appropriate color class based on price drop factor
function getPriceDropClass(factor) {
  if (factor < 1.4) return 'text-success';
  if (factor < 2.0) return 'text-warning';
  return 'text-danger';
}

// Process investment
async function processInvestment(amount, riskLevel) {
  try {
    // Show processing modal
    modalMessage.textContent = `Processing your $${amount} investment at ${riskLevel} risk level...`;
    txModal.show();
    
    const response = await fetch(API.INVEST, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, riskLevel })
    });
    
    const data = await response.json();
    
    // Hide the modal
    txModal.hide();
    
    if (data.success) {
      // Show success message
      transactionContainer.classList.remove('d-none');
      transactionStatus.classList.remove('alert-danger');
      transactionStatus.classList.add('alert-success');
      transactionStatus.innerHTML = `
        <h5>Investment Successful!</h5>
        <p>You have invested $${amount} at ${riskLevel} risk level.</p>
        <p>Transaction Hash: <a href="https://explorer.blaze.soniclabs.com/tx/${data.transactionHash}" target="_blank">
          ${data.transactionHash.substring(0, 10)}...${data.transactionHash.substring(data.transactionHash.length - 8)}
        </a></p>
      `;
    } else {
      throw new Error(data.message || 'Transaction failed');
    }
  } catch (error) {
    console.error('Investment error:', error);
    
    // Hide the modal if still showing
    txModal.hide();
    
    // Show error message
    transactionContainer.classList.remove('d-none');
    transactionStatus.classList.remove('alert-success');
    transactionStatus.classList.add('alert-danger');
    transactionStatus.innerHTML = `
      <h5>Investment Failed</h5>
      <p>${error.message || 'An error occurred while processing your investment.'}</p>
      <p>Please try again later.</p>
    `;
  }
}

// Helper Functions
function getRiskAlertClass(riskLevel) {
  switch (riskLevel) {
    case 'low': return 'success';
    case 'medium': return 'warning';
    case 'high': return 'danger';
    default: return 'info';
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function highlightRecommendedOption(riskLevel) {
  // Remove existing recommended class
  document.querySelectorAll('.risk-card').forEach(card => {
    card.classList.remove('recommended');
  });
  
  // Add recommended class to the suggested risk level
  const recommendedCard = document.querySelector(`.risk-${riskLevel}`);
  if (recommendedCard) {
    recommendedCard.classList.add('recommended');
  }
}

// Event Listeners
function setupEventListeners() {
  // Refresh button
  refreshButton.addEventListener('click', async () => {
    await fetchPrice();
    await fetchAnalysis();
  });
  
  // Investment buttons
  investButtons.forEach(button => {
    button.addEventListener('click', () => {
      const amount = parseInt(button.dataset.amount);
      const riskLevel = button.dataset.risk;
      
      if (confirm(`Confirm ${amount} investment at ${riskLevel} risk level?`)) {
        processInvestment(amount, riskLevel);
      }
    });
  });
}