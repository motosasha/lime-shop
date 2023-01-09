import ready from "../../js/utils/documentReady.js";

ready(function () {
  const headerInfo = document.querySelector(".header-info");
  const infoTrigger = document.querySelector(".header-info__trigger");

  infoTrigger.addEventListener("click", () => {
    headerInfo.classList.toggle("header-info--drop");
  });
});
