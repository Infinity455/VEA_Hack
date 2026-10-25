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
