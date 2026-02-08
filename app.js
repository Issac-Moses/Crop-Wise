// ==========================================
// CONFIGURATION
// ==========================================
const API_KEY = '';
const API_URL = ``;

// ==========================================
// DOM ELEMENTS
// ==========================================
const soilForm = document.getElementById('soilForm');
const resultsSection = document.getElementById('resultsSection');
const loadingState = document.getElementById('loadingState');
const resultsContainer = document.getElementById('resultsContainer');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const analyzeBtn = document.getElementById('analyzeBtn');

// ==========================================
// FORM SUBMISSION HANDLER
// ==========================================
soilForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form data
    const formData = {
        nitrogen: parseFloat(document.getElementById('nitrogen').value),
        phosphorus: parseFloat(document.getElementById('phosphorus').value),
        potassium: parseFloat(document.getElementById('potassium').value),
        ph: parseFloat(document.getElementById('ph').value),
        moisture: parseFloat(document.getElementById('moisture').value),
        temperature: parseFloat(document.getElementById('temperature').value),
        rainfall: parseFloat(document.getElementById('rainfall').value),
        soilType: document.getElementById('soilType').value
    };

    // Validate form data
    if (!validateFormData(formData)) {
        return;
    }

    // Show results section and loading state
    showLoadingState();

    // Analyze soil and get recommendations
    try {
        const recommendations = await analyzeSoilWithGemini(formData);
        displayRecommendations(recommendations);
    } catch (error) {
        showError(error.message);
    }
});

// ==========================================
// VALIDATION
// ==========================================
function validateFormData(data) {
    const validations = [
        { field: 'nitrogen', min: 0, max: 140, name: 'Nitrogen' },
        { field: 'phosphorus', min: 5, max: 145, name: 'Phosphorus' },
        { field: 'potassium', min: 5, max: 205, name: 'Potassium' },
        { field: 'ph', min: 3.5, max: 9.5, name: 'pH Level' },
        { field: 'moisture', min: 0, max: 100, name: 'Soil Moisture' },
        { field: 'temperature', min: 8, max: 45, name: 'Temperature' },
        { field: 'rainfall', min: 20, max: 300, name: 'Rainfall' }
    ];

    for (const validation of validations) {
        const value = data[validation.field];
        if (value < validation.min || value > validation.max) {
            alert(`${validation.name} must be between ${validation.min} and ${validation.max}`);
            return false;
        }
    }

    if (!data.soilType) {
        alert('Please select a soil type');
        return false;
    }

    return true;
}


// ==========================================
// GEMINI API INTEGRATION
// ==========================================
async function analyzeSoilWithGemini(soilData) {
    const prompt = createPrompt(soilData);

    // Build chat history format like Frenzy
    const chatHistory = [
        {
            role: "user",
            parts: [{ text: prompt }]
        }
    ];

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: chatHistory })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ API Response Error:', data);
            throw new Error(data.error?.message || `API error: ${response.status}`);
        }

        // Extract response text exactly like Frenzy does
        let responseText = "";

        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];

            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                responseText = candidate.content.parts[0].text || "";
            }
        }

        // If no response text, throw error
        if (!responseText) {
            console.error('❌ Empty response from API:', data);
            throw new Error('Empty response from API');
        }

        console.log('✅ Raw AI Response:', responseText);

        // Parse the response
        return parseAIResponse(responseText);

    } catch (error) {
        console.error('❌ Gemini API Error:', error);
        throw new Error(`AI Analysis Failed: ${error.message}`);
    }
}

// ==========================================
// PROMPT ENGINEERING
// ==========================================
function createPrompt(soilData) {
    return `You are an expert agricultural scientist. Analyze the soil data and recommend the top 5 suitable crops.

SOIL DATA:
- Nitrogen: ${soilData.nitrogen} kg/ha
- Phosphorus: ${soilData.phosphorus} kg/ha  
- Potassium: ${soilData.potassium} kg/ha
- pH: ${soilData.ph}
- Moisture: ${soilData.moisture}%
- Temperature: ${soilData.temperature}°C
- Rainfall: ${soilData.rainfall} mm
- Soil Type: ${soilData.soilType}

Provide exactly 5 crop recommendations in JSON format. Return ONLY the JSON array, no other text.

[
  {
    "cropName": "Crop Name",
    "suitability": "Excellent/Very Good/Good",
    "growingSeason": "Season and duration",
    "waterRequirement": "Water needs description",
    "expectedYield": "Yield estimate",
    "reasoning": "Why this crop suits these soil conditions"
  }
]

Important: Return only valid JSON. No markdown, no code blocks, just the JSON array.`;
}

// ==========================================
// RESPONSE PARSING
// ==========================================
// ==========================================
// RESPONSE PARSING
// ==========================================
function parseAIResponse(responseText) {
    try {
        console.log('📝 Parsing AI response...');

        // Clean the response text
        let cleanedText = responseText.trim();

        // Remove markdown code blocks
        cleanedText = cleanedText.replace(/```json\s*/gi, '');
        cleanedText = cleanedText.replace(/```\s*/g, '');
        cleanedText = cleanedText.replace(/"""/g, '');

        // Try to extract JSON array using regex
        const jsonMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
            cleanedText = jsonMatch[0];
        }

        console.log('🧹 Cleaned text (first 300 chars):', cleanedText.substring(0, 300));

        // Parse JSON
        const recommendations = JSON.parse(cleanedText);

        // Validate structure
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
            throw new Error('Invalid recommendations format - not an array');
        }

        // Validate and normalize each recommendation
        const normalizedRecs = [];
        for (let i = 0; i < Math.min(recommendations.length, 5); i++) {
            const rec = recommendations[i];

            if (!rec.cropName) {
                console.warn('⚠️ Skipping recommendation without cropName:', rec);
                continue;
            }

            normalizedRecs.push({
                rank: i + 1,
                cropName: rec.cropName || 'Unknown Crop',
                suitability: rec.suitability || 'Good',
                growingSeason: rec.growingSeason || 'Not specified',
                waterRequirement: rec.waterRequirement || 'Not specified',
                expectedYield: rec.expectedYield || 'Not specified',
                reasoning: rec.reasoning || 'Suitable for given soil conditions'
            });
        }

        if (normalizedRecs.length === 0) {
            throw new Error('No valid crop recommendations found');
        }

        console.log(`✅ Successfully parsed ${normalizedRecs.length} recommendations`);
        return normalizedRecs;

    } catch (error) {
        console.error('❌ Parse Error:', error);
        console.error('📄 Response Text:', responseText);
        throw new Error('Failed to parse AI recommendations. The AI response was not in the expected format.');
    }
}

// ==========================================
// UI STATE MANAGEMENT
// ==========================================
function showLoadingState() {
    resultsSection.style.display = 'block';
    loadingState.style.display = 'block';
    resultsContainer.style.display = 'none';
    errorState.style.display = 'none';

    // Disable form
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'ANALYZING...';

    // Smooth scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function showError(message) {
    loadingState.style.display = 'none';
    resultsContainer.style.display = 'none';
    errorState.style.display = 'block';
    errorMessage.textContent = message;

    // Re-enable form
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'INITIATE ANALYSIS';
}

// ==========================================
// DISPLAY RECOMMENDATIONS
// ==========================================
function displayRecommendations(recommendations) {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    resultsContainer.style.display = 'grid';

    // Clear previous results
    resultsContainer.innerHTML = '';

    // Create crop cards
    recommendations.forEach((crop, index) => {
        const card = createCropCard(crop, index + 1);
        resultsContainer.appendChild(card);
    });

    // Re-enable form
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'INITIATE ANALYSIS';
}
// ==========================================
// CREATE CROP CARD
// ==========================================
function createCropCard(crop, rank) {
    const card = document.createElement('div');
    card.className = 'crop-card';

    // Determine suitability color
    const suitabilityClass = getSuitabilityClass(crop.suitability);

    card.innerHTML = `
        <div class="crop-rank">${rank}</div>
        
        <div class="crop-header">
            <h3 class="crop-name">${escapeHtml(crop.cropName)}</h3>
            <span class="crop-suitability ${suitabilityClass}">
                ${escapeHtml(crop.suitability)}
            </span>
        </div>
        
        <div class="crop-details">
            <div class="detail-item">
                <span class="detail-label">🌾 Growing Season</span>
                <span class="detail-value">${escapeHtml(crop.growingSeason)}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">💧 Water Requirements</span>
                <span class="detail-value">${escapeHtml(crop.waterRequirement)}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">📊 Expected Yield</span>
                <span class="detail-value">${escapeHtml(crop.expectedYield)}</span>
            </div>
        </div>
        
        <div class="crop-reasoning">
            <span class="detail-label">💡 Why This Crop?</span>
            <p class="detail-value">${escapeHtml(crop.reasoning)}</p>
        </div>
    `;

    return card;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function getSuitabilityClass(suitability) {
    const lower = suitability.toLowerCase();
    if (lower.includes('excellent')) return 'excellent';
    if (lower.includes('very good')) return 'very-good';
    return 'good';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// INITIALIZE
// ==========================================
console.log('🌱 CropWise - Soil Analysis System Initialized');
console.log('Ready to analyze soil and provide crop recommendations!');
