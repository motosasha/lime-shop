import ready from "../../js/utils/documentReady.js";

ready(function () {
  // mobile menu
  let $menuTrigger = document.querySelector(".header__menu");
  $menuTrigger.addEventListener("click", function () {
    let bodyState = document.body.getAttribute("data-state");
    bodyState === "open"
      ? (document.body.dataset.state = "")
      : (document.body.dataset.state = "open");
  });
});
