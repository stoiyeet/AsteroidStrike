# AsteroidStrike — Asteroid Impact Simulation Engine

![image](https://asteroidstrike.earth/appHeader/size_1200_630_clickbait.png?v=2.0)




AsteroidStrike is a physics-based asteroid impact simulation application and API. It models atmospheric entry, airburst vs. surface impact behavior, crater formation, thermal and seismic effects, blast damage, tsunami potential, and estimated human mortality impact using published scientific impact models.

---

# Run Instructions (Local Development)

## Requirements

- Node.js 18 or newer
- npm (or pnpm/yarn)
- Git

## Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/stoiyeet/AsteroidStrike.git  
cd AsteroidStrike 
npm install  
```

## Run Development Server

Start the dev server:

```bash
npm run dev  
```

Then open your browser to:

http://localhost:3000

## Production Build

Create a production build:

```bash
npm run build  

# Start the production server:

npm start  
```

---

# API Usage

Interactive API documentation is available here:

https://stoiyeet.github.io/AsteroidStrike

Use the interactive Scalar page to:
- enter request parameters
- execute live API calls
- view formatted JSON responses
- authorize with an API key (for report generation endpoints)

## Main Endpoint

```http
POST /api/impact-engine
```

Computes asteroid impact effects and mortality estimates from:
- meteor physical parameters
- entry angle and velocity
- impact coordinates

Returns structured JSON results with modeled physical and human impact metrics.

Optional PDF report generation is supported. When report generation is requested, the API returns a report ID that can later be used to download the generated PDF.

## Supporting Endpoints

```http
POST /api/keys  
```
Creates an API key associated with a valid email address for authenticated features.

```http
GET /api/reports/{id}  
```
Downloads a previously generated PDF report by report ID.

Full request and response schemas, examples, and parameter descriptions are provided in the API documentation site linked above.

---

# Scientific Basis and Attribution

This project’s impact physics modeling is based on the Earth Impact Effects framework described in:

Earth Impact Effects Program — A Web-based Computer Program for Calculating the Regional Environmental Consequences of a Meteoroid Impact on Earth

Authors:
Gareth S. Collins  
H. Jay Melosh  
Robert A. Marcus  

Paper:
https://impact.ese.ic.ac.uk/ImpactEarth/ImpactEffects/effects.pdf

AsteroidStrike adapts and operationalizes these published models into a modern application and API. All scientific credit for the underlying physical models belongs to the original authors.

---
