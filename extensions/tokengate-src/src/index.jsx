import ReactDOM from "react-dom";
import React from "react";
import {App} from './App';


// the element id is defined in app-block.liquid
const container = document.getElementById("amora");
if (container.dataset.product_gated === 'true') {
  ReactDOM.createRoot(container).render(<App />);
} else {
  container.innerHTML = 'This product is not gated.';
}
