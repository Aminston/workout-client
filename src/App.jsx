// src/App.jsx
import './App.css';
import './index.css'; // optional, usually global styles (already imported in main.jsx)
import WeeklyWorkout from './components/WorkoutSchedule/WeeklyWorkout';
import Navbar from './components/Navbar/Navbar';

function App() {
  return (
    <div className="app-root">
      <Navbar />
      <main className="app-main">
        <div className="content-scrollable">
          <WeeklyWorkout />
        </div>
      </main>
    </div>
  );
}

export default App;
