## Keylusion
Keylusion is a browser-based virtual piano that allows users to play musical notes using hand movements in front of their webcam. Instead of using a physical keyboard, users control piano sounds through real-time hand tracking.
The application combines computer vision, audio processing, and web development to create an interactive musical experience. Users can play notes, record their jam sessions with video and audio, save recordings, and optionally receive AI-powered music suggestions.

## Tech Stack
### Frontend
- **React:** Builds the user interface using reusable components and separate pages.
- **Vite:** Provides the development server and builds the application for deployment.
- **JavaScript and JSX:** Handle application logic and define React components.
- **CSS / Tailwind CSS:** Styles the interface, including buttons, piano keys, and page layouts.
- **React Router:** Allows users to navigate between pages without reloading the entire application.
### Hand Tracking
- **MediaPipe Hand Landmarker:** Detects hand landmarks through the webcam and tracks finger positions in real time.
- **Webcam API (`getUserMedia`):** Accesses the user's camera with permission.
- **Custom Gesture Detection:** Maps finger movements to musical notes.
### Authentication and Storage
- **Supabase Authentication:** Handles user registration, login, and logout.
- **Supabase Storage:** Stores recorded performances for later access.
- **Supabase Database:** Stores recording information, such as titles, timestamps, and file locations.
### Deployment
- **Vercel:** Used before and she is good!

### Local Gemma AI (Vertex AI)
The piano page includes a Gemma music coach that can suggest notes based on
recently played notes or generate a short note sequence from a request.

1. In Google Cloud, select a project, enable billing and the Vertex AI API,
   then deploy an instruction-tuned Gemma model from Model Garden. Copy the
   endpoint ID from **Vertex AI → Online prediction → Endpoints**.
2. Install the Google Cloud CLI, then run `gcloud auth application-default login`.
   Your account needs permission to use Vertex AI in the project.
3. Add `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`,
   `VERTEX_ENDPOINT_ID`, and `VERTEX_ENDPOINT_HOST` to your existing `.env` or
   `.env.local`. Use the exact endpoint ID and region shown in the Cloud
   Console. For a dedicated endpoint, set `VERTEX_ENDPOINT_HOST` to its
   dedicated domain (for example,
   `1176790252778422272.us-central1-716596888576.prediction.vertexai.goog`).
   Keep your existing Supabase settings. The API uses Application Default
   Credentials; it does not use a browser API key.
4. In one terminal, run `npm.cmd run dev:api`.
5. In another terminal, run `npm.cmd run dev` and open the Vite URL it prints.

The API server listens only on localhost and Vite forwards `/api` requests to
it on port 3001. Requests use Vertex AI's `chatCompletions` prediction format
for deployed Model Garden endpoints. If `VERTEX_ENDPOINT_HOST` is omitted,
the API uses the regional shared Vertex AI domain.
  
## Assigned Tasks
#### Infinity455
- set up react and vite
- help set up main page/design
- create gemma api
- code gemma conditions and integrate her into the main piano page
#### Alonavtech
- create login page
- login auhentification
- create profile/account 
- add a recording button with supabase storage
#### Vianneej
- figure out how to use/set up mediapipe
- create piano key note code
- set up piano main page
- create looper 
  
## Resource Videos
### MediaPipe 
- https://www.youtube.com/watch?v=hV5S4iQhNkI
- https://www.youtube.com/watch?v=cJgDuywJv8Y
### Supabase 
- https://www.youtube.com/watch?v=12HYHdI2hvY
