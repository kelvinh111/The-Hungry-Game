var gulp        = require('gulp');
var sass        = require('gulp-ruby-sass');
var browserSync = require('browser-sync');
var filter      = require('gulp-filter');
var minifycss   = require('gulp-minify-css');
var rename      = require('gulp-rename');
var concat      = require('gulp-concat');
var uglify      = require('gulp-uglify');

var devPath = "./static/dev_kelvin/";
var prodPath = "./static/prod/";

var scssPath = "./assets/scss/";
var cssPath = "css/";
var jsPath = "js/";
var compiledJsPath = "js/";

var jsFiles = [
"vendor/jquery-1.11.1.min.js",
"vendor/jquery.cookie.min.js",
"vendor/underscore-min.js",
"vendor/angular.min.js",
"vendor/socket.io.min.js",
"vendor/moment.min.js",
"main.js"];
jsFiles = jsFiles.map(function(f) {
    return devPath + jsPath + f;
})

var proxyUrl = "localhost:5000";

gulp.task('sass', function () {
    return gulp.src([scssPath + '**/*.scss', '!' + scssPath + '**/_*.scss'])
    .pipe(sass({
        compass: true,
        sourcemap: true
    }))
    .pipe(gulp.dest(devPath + cssPath))
    .pipe(filter('**/*.css')) // Filtering stream to only css files
    .pipe(browserSync.reload({stream:true}));
});

gulp.task('sass-prod', function () {
    gulp.src([scssPath + '**/*.scss', '!' + scssPath + '**/_*.scss'])
    .pipe(sass({ 
        compass: true,
        sourcemap: false,
        style: 'compact'
    }))
    .pipe(minifycss())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest(prodPath + cssPath));
});

gulp.task('js-prod', function () {
    gulp.src(jsFiles)
    .pipe(uglify())
    .pipe(concat('compiled.min.js'))
    .pipe(gulp.dest(prodPath + jsPath));
});

// Start the server
gulp.task('browser-sync', function() {
    browserSync({
        proxy: proxyUrl
    });
});

// Reload all Browsers
gulp.task('bs-reload', function () {
    browserSync.reload();
});

gulp.task('production', ['sass-prod', 'js-prod']);

gulp.task('default', ['browser-sync', 'sass'], function () {
    gulp.watch(scssPath + '**/*.scss', ['sass', 'sass-prod']);
    gulp.watch(devPath + jsPath + '**/*.js', ['js-prod', 'bs-reload']);
});
