import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ToastProvider = () => {
  return <ToastContainer autoClose={3000} theme="dark" />;
};

export default ToastProvider;
