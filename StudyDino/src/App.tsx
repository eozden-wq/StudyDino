import { Map, MapControls } from "@/components/ui/map";
import './App.css'

function App() {
  return (
    <div className="w-full h-screen">
      <Map center={[-1.57566, 54.77676]} zoom={11}>
        <MapControls />
      </Map>
    </div>
  )
}

export default App
