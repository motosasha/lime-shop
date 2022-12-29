/* global exports process console __dirname Buffer */
/* eslint-disable no-console */
"use strict";

// Пакеты, использующиеся при обработке
import atImport from "postcss-import";
import autoprefixer from "autoprefixer";
import browserSync from "browser-sync";
import cheerio from "gulp-cheerio";
import cpy from "cpy";
import csso from "gulp-csso";
import debug from "gulp-debug";
import fs from "fs";
import getClassesFromHtml from "get-classes-from-html";
import ghPages from "gh-pages";
import gulp from "gulp";
import gulpSass from "gulp-sass";
import jsonConcat from "gulp-json-concat";
import mqPacker from "css-mqpacker";
import path, { dirname } from "path";
import plumber from "gulp-plumber";
import postcss from "gulp-postcss";
import prettyHtml from "gulp-pretty-html";
import pug from "gulp-pug";
import rename from "gulp-rename";
import replace from "gulp-replace";
import svgMin from "gulp-svgmin";
import svgStore from "gulp-svgstore";
import theSass from "sass";
import through2 from "through2";
import uglifyES from "gulp-uglify-es";
import webpackStream from "webpack-stream";
import { deleteAsync } from "del";
import { fileURLToPath } from "url";

const { series, parallel, src, dest, watch, lastRun } = gulp;
const sass = gulpSass(theSass);
const uglify = uglifyES.default;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Глобальные настройки этого запуска
const buildLibrary = process.env.BUILD_LIBRARY || false;
const mode = process.env.MODE || "development";
import config from "./config.js";
let blocksFromHtml = Object.create(config.alwaysAddBlocks); // блоки из конфига сразу добавим в список блоков
let scssImportsList = []; // список импортов стилей
const dir = config.dir;

// Сообщение для компилируемых файлов
let doNotEditMsg = "\n ВНИМАНИЕ! Этот файл генерируется автоматически.\n Любые изменения этого файла будут потеряны при следующей компиляции.\n Любое изменение проекта без возможности компиляции ДОЛЬШЕ И ДОРОЖЕ в 2-5 раз.\n\n";


// Настройки бьютификатора
let prettyOption = {
  indent_size: 2,
  indent_char: " ",
  unformatted: ["code", "em", "strong", "span", "i", "b", "br", "script"],
  content_unformatted: []
};

// Список и настройки плагинов postCSS
let postCssPlugins = [
  autoprefixer({grid: true}),
  mqPacker({
    sort: true
  }),
  atImport()
];


export function writePugMixinsFile(cb) {
  let allBlocksWithPugFiles = getDirectories("pug");
  let pugMixins = "//-" + doNotEditMsg.replace(/\n /gm, "\n  ");
  allBlocksWithPugFiles.forEach(function(blockName) {
    pugMixins += `include ${dir.blocks.replace(dir.src, "../")}${blockName}/${blockName}.pug\n`;
  });
  fs.writeFileSync(`${dir.src}pug/mixins.pug`, pugMixins);
  cb();
}


export function compilePug() {
  const fileList = [
    `${dir.src}pages/**/*.pug`
  ];
  if (!buildLibrary) fileList.push(`!${dir.src}pages/library.pug`);
  return src(fileList)
    .pipe(plumber({
      errorHandler: function(err) {
        console.log(err.message);
        this.emit("end");
      }
    }))
    .pipe(debug({ title: "Compiles " }))
    .pipe(pug({
      data: { repoUrl: "https://github.com/motosasha/builder" },
      filters: { "show-code": filterShowCode },
      locals: JSON.parse(fs.readFileSync("./src/json/data.json", "utf8"))
    }))
    .pipe(prettyHtml(prettyOption))
    .pipe(replace(/^(\s*)(<button.+?>)(.*)(<\/button>)/gm, "$1$2\n$1  $3\n$1$4"))
    .pipe(replace(/^( *)(<.+?>)(<script>)([\s\S]*)(<\/script>)/gm, "$1$2\n$1$3\n$4\n$1$5\n"))
    .pipe(through2.obj(getClassesToBlocksList, "", ""))
    .pipe(dest(dir.build));
}


export function compilePugFast() {
  const fileList = [
    `${dir.src}pages/**/*.pug`
  ];
  if (!buildLibrary) fileList.push(`!${dir.src}pages/library.pug`);
  return src(fileList, { since: lastRun(compilePugFast) })
    .pipe(plumber({
      errorHandler: function(err) {
        console.log(err.message);
        this.emit("end");
      }
    }))
    .pipe(debug({ title: "Compiles " }))
    .pipe(pug({
      data: { repoUrl: "https://github.com/motosasha/builder" },
      filters: { "show-code": filterShowCode },
      locals: JSON.parse(fs.readFileSync("./src/json/data.json", "utf8"))
    }))
    .pipe(prettyHtml(prettyOption))
    .pipe(replace(/^(\s*)(<button.+?>)(.*)(<\/button>)/gm, "$1$2\n$1  $3\n$1$4"))
    .pipe(replace(/^( *)(<.+?>)(<script>)([\s\S]*)(<\/script>)/gm, "$1$2\n$1$3\n$4\n$1$5\n"))
    .pipe(through2.obj(getClassesToBlocksList, "", ""))
    .pipe(dest(dir.build));
}


export function buildJson(cb) {
  const jsonList = `${dir.data}**/*.json`;
  if (jsonList) {
   return src(jsonList)
      .pipe(plumber())
      .pipe(jsonConcat('data.json',function(data){
        return new Buffer.from(JSON.stringify(data));
      }))
      .pipe(dest(`${dir.src}json`));
  } else {
    cb();
  }
}


export function copyAssets(cb) {
  let assetsPath = `${dir.src}assets/`;
  if(fileExist(assetsPath)) {
    return src(assetsPath + '**/*.*')
      .pipe(dest(`${dir.build}assets/`))
  }
  else {
    cb();
  }
}


export function copyImg(cb) {
  let imgPath = `${dir.src}img/`;
  if(fileExist(imgPath)) {
    return src(imgPath + '**/*.*')
      .pipe(dest(`${dir.build}img/`))
  }
  else {
    cb();
  }
}


export function copyBlockImg(cb) {
  let copiedImages = [];
  blocksFromHtml.forEach(function(block) {
    let src = `${dir.blocks}${block}/img`;
    if (fileExist(src)) copiedImages.push(`${src}/**/*.{png,jpg,jpeg,svg,gif}`);
  });
  config.alwaysAddBlocks.forEach(function(block) {
    let src = `${dir.blocks}${block}/img`;
    if (fileExist(src)) copiedImages.push(`${src}/**/*.{png,jpg,jpeg,svg,gif}`);
  });
  if (copiedImages.length) {
    (async () => {
      await cpy(copiedImages, `${dir.build}img`);
      cb();
    })();
  } else {
    cb();
  }
}


export function generateSvgSprite(cb) {
  let spriteSvgPath = `${dir.src}symbols/`;
  if (fileExist(spriteSvgPath)) {
    return src(spriteSvgPath + "*.svg")
      .pipe(plumber({
        errorHandler: function (err) {
          console.log(err.message);
          this.emit('end');
        }
      }))
      .pipe(svgMin(function() {
        return {
          plugins: [
            {
              cleanupIDs: { minify: true }
            },
            {
              name: "removeAttrs",
              params: {
                attrs: "(height|width)"
              }
            },
            {
              removeViewBox: false
            }
          ]
        };
      }))
      .pipe(svgStore({ inlineSvg: true }))
      .pipe(cheerio({
        run: function ($) {
          let addition = fs.readFileSync(dir.svgAsBg, "utf8");
          $('svg').append(addition);
        },
        parserOptions: { xmlMode: true }
      }))
      .pipe(rename("svgSprite.svg"))
      .pipe(dest(`${dir.build}img/`));
  } else {
    cb();
  }
}


export function writeSassImportsFile(cb) {
  const newScssImportsList = [];
  config.addStyleBefore.forEach(function(src) {
    newScssImportsList.push(src);
  });
  config.alwaysAddBlocks.forEach(function(blockName) {
    if (fileExist(`${dir.blocks}${blockName}/${blockName}.scss`)) newScssImportsList.push(`${dir.blocks}${blockName}/${blockName}.scss`);
  });
  let allBlocksWithScssFiles = getDirectories("scss");
  allBlocksWithScssFiles.forEach(function(blockWithScssFile) {
    let url = `${dir.blocks}${blockWithScssFile}/${blockWithScssFile}.scss`;
    if (blocksFromHtml.indexOf(blockWithScssFile) === -1) return;
    if (newScssImportsList.indexOf(url) > -1) return;
    newScssImportsList.push(url);
  });
  config.addStyleAfter.forEach(function(src) {
    newScssImportsList.push(src);
  });
  let diff = getArraysDiff(newScssImportsList, scssImportsList);
  if (diff.length) {
    let msg = `\n/*!*${doNotEditMsg.replace(/\n /gm, "\n * ").replace(/\n\n$/, "\n */\n\n")}`;
    let styleImports = msg;
    newScssImportsList.forEach(function(src) {
      styleImports += `@import "${src}";\n`;
    });
    styleImports += msg;
    fs.writeFileSync(`${dir.src}scss/style.scss`, styleImports);
    console.log("---------- Write new style.scss");
    scssImportsList = newScssImportsList;
  }
  cb();
}


export function compileSass() {
  const fileList = [
    `${dir.src}scss/style.scss`
  ];
  if (buildLibrary) fileList.push(`${dir.blocks}blocks-library/blocks-library.scss`);
  return src(fileList, { sourcemaps: true })
    .pipe(plumber({
      errorHandler: function(err) {
        console.log(err.message);
        this.emit("end");
      }
    }))
    .pipe(debug({ title: "Compiles:" }))
    .pipe(sass({ includePaths: [__dirname + "/", "node_modules"] }, ""))
    .pipe(postcss(postCssPlugins))
    .pipe(csso({
      restructure: false
    }))
    .pipe(dest(`${dir.build}/css`, { sourcemaps: mode === "development" ? "." : false }))
    .pipe(browserSync.stream());
}


export function writeJsRequiresFile(cb) {
  const jsRequiresList = [];
  config.addJsBefore.forEach(function(src) {
    jsRequiresList.push(src);
  });
  const allBlocksWithJsFiles = getDirectories("js");
  allBlocksWithJsFiles.forEach(function(blockName) {
    if (config.alwaysAddBlocks.indexOf(blockName) === -1) return;
    jsRequiresList.push(`../blocks/${blockName}/${blockName}.js`);
  });
  allBlocksWithJsFiles.forEach(function(blockName) {
    let src = `../blocks/${blockName}/${blockName}.js`;
    if (blocksFromHtml.indexOf(blockName) === -1) return;
    if (jsRequiresList.indexOf(src) > -1) return;
    jsRequiresList.push(src);
  });
  config.addJsAfter.forEach(function(src) {
    jsRequiresList.push(src);
  });
  let msg = `\n/*!*${doNotEditMsg.replace(/\n /gm, "\n * ").replace(/\n\n$/, "\n */\n\n")}`;
  let jsRequires = msg + "/* global require */\n\n";
  jsRequiresList.forEach(function(src) {
    jsRequires += `require('${src}');\n`;
  });
  jsRequires += msg;
  fs.writeFileSync(`${dir.src}js/entry.js`, jsRequires);
  console.log("---------- Write new entry.js");
  cb();
}


export function buildJs() {
  const entryList = {
    "bundle": `./${dir.src}js/entry.js`
  };
  if (buildLibrary) entryList["blocks-library"] = `./${dir.blocks}blocks-library/blocks-library.js`;
  return src(`${dir.src}js/entry.js`)
    .pipe(plumber())
    .pipe(webpackStream({
      mode: mode,
      entry: entryList,
      devtool: mode === "development" ? "inline-source-map" : false,
      output: {
        filename: "[name].js"
      },
      resolve: {
        alias: {
          Utils: path.resolve(__dirname, "src/js/utils/")
        }
      },
      module: {
        rules: [
          {
            test: /\.(js)$/,
            exclude: /(node_modules)/,
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"]
            }
          }
        ]
      },
      // externals: {
      //   jquery: "jQuery"
      // }
    }))
    .pipe(uglify({
      output: {
        comments: false
      }
    }))
    .pipe(dest(`${dir.build}js`));
}


export function copyAdditions(cb) {
  for (let item in config.addAdditions) {
    let dest = `${dir.build}${config.addAdditions[item]}`;
    cpy(item, dest);
  }
  cb();
}


export function copyFonts(cb) {
  let fontsPath = `${dir.src}fonts/`;
  if(fileExist(fontsPath)) {
    return src(fontsPath + '**/*.*')
      .pipe(dest(`${dir.build}/fonts/`))
  }
  else {
    cb();
  }
}


export function clearBuildDir() {
  return deleteAsync([
    `${dir.build}**/*`,
    `!${dir.build}readme.md`
  ]);
}


export function reload(done) {
  browserSync.reload();
  done();
}

export function deploy(cb) {
  ghPages.publish(path.join(process.cwd(), dir.build), "", cb).then();
}


export function serve() {

  browserSync.init({
    server: dir.build,
    host: '192.168.1.39',
    logPrefix: "dev-server",
    port: 3000,
    startPath: 'index.html',
    open: false,
    notify: false,
  });

  // Страницы: изменение, добавление
  watch([`${dir.src}pages/**/*.pug`], { events: ["change", "add"], delay: 100 }, series(
    compilePugFast,
    parallel(writeSassImportsFile, writeJsRequiresFile),
    parallel(compileSass, buildJs),
    reload
  ));

  // Страницы: удаление
  watch([`${dir.src}pages/**/*.pug`], { delay: 100 })
    // TODO попробовать с events: ["unlink"]
    .on("unlink", function(path) {
      let filePathInBuildDir = path.replace(`${dir.src}pages/`, dir.build).replace(".pug", ".html");
      fs.unlink(filePathInBuildDir, (err) => {
        if (err) throw err;
        console.log(`---------- Delete:  ${filePathInBuildDir}`);
      });
    });

  // Разметка Блоков: изменение
  watch([`${dir.blocks}**/*.pug`], { events: ["change"], delay: 100 }, series(
    compilePug,
    reload
  ));

  // Разметка Блоков: добавление
  watch([`${dir.blocks}**/*.pug`], { events: ["add"], delay: 100 }, series(
    writePugMixinsFile,
    compilePug,
    reload
  ));

  // Разметка Блоков: удаление
  watch([`${dir.blocks}**/*.pug`], { events: ["unlink"], delay: 100 }, writePugMixinsFile);

  // Шаблоны pug: все события
  watch([`${dir.src}pug/**/*.pug`, `!${dir.src}pug/mixins.pug`], { delay: 100 }, series(
    compilePug,
    parallel(writeSassImportsFile, writeJsRequiresFile),
    parallel(compileSass, buildJs),
    reload,
  ));

  // Стили Блоков: изменение
  watch([`${dir.blocks}**/*.scss`], { events: ["change"], delay: 100 }, series(
    compileSass
  ));

  // Стили Блоков: добавление
  watch([`${dir.blocks}**/*.scss`], { events: ["add"], delay: 100 }, series(
    writeSassImportsFile,
    compileSass
  ));

  // Стилевые глобальные файлы: все события
  watch([`${dir.src}scss/**/*.scss`, `!${dir.src}scss/style.scss`], { events: ["all"], delay: 100 }, series(
    compileSass
  ));

  // Скриптовые глобальные файлы: все события
  watch([`${dir.src}js/**/*.js`, `!${dir.src}js/entry.js`, `${dir.blocks}**/*.js`], { events: ["all"], delay: 100 }, series(
    writeJsRequiresFile,
    buildJs,
    reload
  ));

  // Копирование Images
  watch([`${dir.src}/img/**/*.{jpg,jpeg,png,gif,svg,webp}`], { events: ['all'], delay: 100 }, series(
    copyImg,
    reload,
  ));

  // Картинки: все события
  watch([`${dir.blocks}**/img/**/*.{jpg,jpeg,png,gif,svg,webp}`], { events: ["all"], delay: 100 }, series(
    copyBlockImg,
    reload
  ));

  // Копирование Assets
  watch([`${dir.src}assets/**/*.*`], { events: ['all'], delay: 100 }, series(
    copyAssets,
    reload,
  ));

  // Копирование Images
  watch([`${dir.src}img/**/*.*`], { events: ['all'], delay: 100 }, series(
    copyImg,
    reload,
  ));

  // Спрайт SVG
  watch([`${dir.src}symbols/*.svg`], { events: ['all'], delay: 100 }, series(
    generateSvgSprite,
    reload,
  ));

  // Копирование шрифтов
  watch([`${dir.src}fonts/`], { events: ['all'], delay: 100 }, series(
    copyFonts,
    reload,
  ));

  // Сборка json: изменение
  watch([`${dir.data}**/*.json`], { events: ['change'], delay: 100 }, series(
    buildJson,
    compilePugFast,
    reload
  ));

  // Сборка json: добавление
  watch([`${dir.data}**/*.json`], { events: ['add'], delay: 100 }, series(
    buildJson,
    compilePugFast,
    reload
  ));

  // Сборка json: все события
  watch([`${dir.data}**/*.json`], { events: ['all'], delay: 100 }, series(
    buildJson,
    compilePugFast,
    reload
  ));
}

gulp.task("build", gulp.series(
    parallel(clearBuildDir, writePugMixinsFile),
    parallel(buildJson),
    parallel(compilePugFast, copyAssets, generateSvgSprite),
    parallel(copyAdditions, copyFonts, copyImg, copyBlockImg, writeSassImportsFile, writeJsRequiresFile),
    parallel(compileSass, buildJs)
  )
)

gulp.task("deploy", gulp.series(
    deploy
  )
)

gulp.task("default", gulp.series(
    parallel(clearBuildDir, writePugMixinsFile),
    parallel(buildJson),
    parallel(compilePugFast, copyAssets, generateSvgSprite),
    parallel(copyAdditions, copyFonts, copyImg, copyBlockImg, writeSassImportsFile, writeJsRequiresFile),
    parallel(compileSass, buildJs),
    serve
  )
)


// Функции, не являющиеся задачами Gulp ----------------------------------------

/**
 * Получение списка классов из HTML и запись его в глоб. переменную blocksFromHtml.
 * @param  {object}   file Обрабатываемый файл
 * @param  {string}   enc  Кодировка
 * @param  {Function} cb   Коллбэк
 */
function getClassesToBlocksList(file, enc, cb) {
  // Передана херь — выходим
  if (file.isNull()) {
    cb(null, file);
    return;
  }
  // Проверяем, не является ли обрабатываемый файл исключением
  let processThisFile = true;
  config.notGetBlocks.forEach(function(item) {
    if (file.relative.trim() === item.trim()) processThisFile = false;
  });
  // Файл не исключён из обработки, погнали
  if (processThisFile) {
    const fileContent = file.contents.toString();
    let classesInFile = getClassesFromHtml(fileContent);
    // blocksFromHtml = [];
    // Обойдём найденные классы
    for (let item of classesInFile) {
      // Не Блок или этот Блок уже присутствует?
      if ((item.indexOf("__") > -1) || (item.indexOf('_') > -1) || (blocksFromHtml.indexOf(item) + 1)) continue;
      // Класс совпадает с классом-исключением из настроек?
      if (config.ignoredBlocks.indexOf(item) + 1) continue;
      // У этого блока отсутствует папка?
      // if (!fileExist(dir.blocks + item)) continue;
      // Добавляем класс в список
      blocksFromHtml.push(item);
    }
    console.log("---------- Used HTML blocks: " + blocksFromHtml.join(", "));
    file.contents = new Buffer.from(fileContent);
  }
  this.push(file);
  cb();
}

//
/**
 * Pug-фильтр, выводящий содержимое pug-файла в виде форматированного текста
 */
function filterShowCode(text, options) {
  let lines = text.split("\n");
  let result = "<pre class=\"code\">\n";
  if (typeof (options["first-line"]) !== "undefined") result = result + "<code>" + options["first-line"] + "</code>\n";
  for (let i = 0; i < (lines.length - 1); i++) { // (lines.length - 1) для срезания последней строки (пустая)
    result = result + "<code>" + lines[i].replace(/</gm, "&lt;") + "</code>\n";
  }
  result = result + "</pre>\n";
  result = result.replace(/<code><\/code>/g, "<code>&nbsp;</code>");
  return result;
}

/**
 * Проверка существования файла или папки
 * @param  {string} filepath      Путь до файла или папки
 * @return {boolean}
 */
function fileExist(filepath){
  let flag = true;
  try{
    fs.accessSync(filepath, fs.F_OK);
  }catch(e){
    flag = false;
  }
  return flag;
}

/**
 * Получение всех названий поддиректорий, содержащих файл указанного расширения, совпадающий по имени с поддиректорией
 * @param  {string} ext    Расширение файлов, которое проверяется
 * @return {array}         Массив из имён блоков
 */
function getDirectories(ext) {
  let source = dir.blocks;
  return fs.readdirSync(source)
    .filter(item => fs.lstatSync(source + item).isDirectory())
    .filter(item => fileExist(source + item + "/" + item + "." + ext));
}

/**
 * Получение разницы между двумя массивами.
 * @param  {array} a1 Первый массив
 * @param  {array} a2 Второй массив
 * @return {array}    Элементы, которые отличаются
 */
function getArraysDiff(a1, a2) {
  return a1.filter(i=>!a2.includes(i)).concat(a2.filter(i=>!a1.includes(i)))
}
