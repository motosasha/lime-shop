import ready from "../../js/utils/documentReady.js";

ready(function () {
  const headerLinks = document.querySelector(".header-links");
  const linksTrigger = document.querySelector(".header-links__trigger");

  linksTrigger.addEventListener("click", () => {
    headerLinks.classList.toggle("header-links--drop");
  });
});
