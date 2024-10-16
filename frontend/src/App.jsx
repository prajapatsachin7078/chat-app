
import { Routes,Route } from 'react-router-dom'
import './App.css'
import Home from './components/pages/Home'
import SignUp from './components/pages/SignUp'
import Login from './components/pages/Login'
import ChatBox from './components/pages/ChatBox'
import { useContext } from 'react'
import {UserContext} from './context/userContext'

function App() {
const {user} = useContext(UserContext);
  return (
    <Routes>
      <Route path='/' element={<Home/>} />
      <Route path = '/signup' element={<SignUp/>}/>
      <Route path = '/login' element={<Login/>}/>
      <Route path ='/chats' element={user?<ChatBox/>:<Login/>}/>
    </Routes>
  )
}

export default App
