var GeneticPolygon = GeneticPolygon || {};

$(
  function() {
    "use strict";

    var ap;

    var workingCanvas;
    var workingCtx;
    var workingData = [];

    var outputCanvas;
    var outputCtx;

    var referenceCanvas;
    var referenceCtx;
    var referenceImage;

    var populationSize;
    var selectionCutoff;
    var mutationChance;
    var mutateAmount;
    var fittestSurvive;
    var randomInheritance;
    var diffSquared;

    var workingSize;
    var polygons;
    var vertices;
    var fillPolygons;

    var clock;
    var jiffies;
    var numberOfImprovements;
    var geneSize;
    var dnaLength;
    var lowestFitness;
    var highestFitness;
    var population;
    var startTime;

    var resumedTime = 0;

    function isSupported() {
      var isSupported = false;

      if (
        referenceCanvas.getContext &&
        referenceCanvas.getContext("2d").getImageData
      ) {
        isSupported = true;
      }

      return isSupported;
    }

    function secondsToString(s) {
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);

      s = Math.floor((s % 3600) % 60);

      return (
        (h > 0 ? h + ":" : "") +
        (m > 0 ? (h > 0 && m < 10 ? "0" : "") + m + ":" : "0:") +
        (s < 10 ? "0" : "") +
        s
      );
    }

    function Individual(mother, father) {
      this.dna = [];

      if (mother && father) {
        var inheritSplit = (Math.random() * dnaLength) >> 0;

        for (var i = 0; i < dnaLength; i += geneSize) {
          var inheritedGene;

          if (randomInheritance) {
            inheritedGene = i < inheritSplit ? mother : father;
          } else {
            inheritedGene = Math.random() < 0.5 ? mother : father;
          }

          for (var j = 0; j < geneSize; j++) {
            var dna = inheritedGene[i + j];

            if (Math.random() < mutationChance) {
              dna += Math.random() * mutateAmount * 2 - mutateAmount;

              if (dna < 0) dna = 0;

              if (dna > 1) dna = 1;
            }

            this.dna.push(dna);
          }
        }
      } else {
        for (var g = 0; g < dnaLength; g += geneSize) {
          this.dna.push(
            Math.random(),
            Math.random(),
            Math.random(),
            Math.max(Math.random() * Math.random(), 0.2)
          );

          var x = Math.random();
          var y = Math.random();

          for (var j = 0; j < vertices; j++) {
            this.dna.push(x + Math.random() - 0.5, y + Math.random() - 0.5);
          }
        }
      }

      this.draw(workingCtx, workingSize, workingSize);

      var imageData = workingCtx.getImageData(0, 0, workingSize, workingSize)
        .data;
      var diff = 0;

      if (diffSquared) {
        for (var p = 0; p < workingSize * workingSize * 4; p++) {
          var dp = imageData[p] - workingData[p];
          diff += dp * dp;
        }

        this.fitness = 1 - diff / (workingSize * workingSize * 4 * 256 * 256);
      } else {
        for (var p = 0; p < workingSize * workingSize * 4; p++)
          diff += Math.abs(imageData[p] - workingData[p]);

        this.fitness = 1 - diff / (workingSize * workingSize * 4 * 256);
      }
    }

    Individual.prototype.draw = function(ctx, width, height) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      for (var g = 0; g < dnaLength; g += geneSize) {
        ctx.beginPath();
        ctx.moveTo(this.dna[g + 4] * width, this.dna[g + 5] * height);

        for (var i = 0; i < vertices - 1; i++) {
          ctx.lineTo(
            this.dna[g + i * 2 + 6] * width,
            this.dna[g + i * 2 + 7] * height
          );
        }

        ctx.closePath();

        var styleString =
          "rgba(" +
          ((this.dna[g] * 255) >> 0) +
          "," +
          ((this.dna[g + 1] * 255) >> 0) +
          "," +
          ((this.dna[g + 2] * 255) >> 0) +
          "," +
          this.dna[g + 3] +
          ")";

        if (fillPolygons) {
          ctx.fillStyle = styleString;
          ctx.fill();
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = styleString;
          ctx.stroke();
        }
      }
    };

    function Population(size) {
      this.individuals = [];

      for (var i = 0; i < size; i++) this.individuals.push(new Individual());
    }

    Population.prototype.iterate = function() {
      if (this.individuals.length > 1) {
        var size = this.individuals.length;
        var offspring = [];

        var selectCount = Math.floor(this.individuals.length * selectionCutoff);

        var randCount = Math.ceil(1 / selectionCutoff);

        this.individuals = this.individuals.sort(function(a, b) {
          return b.fitness - a.fitness;
        });

        if (fittestSurvive) randCount--;

        for (var i = 0; i < selectCount; i++) {
          for (var j = 0; j < randCount; j++) {
            var randIndividual = i;

            while (randIndividual == i)
              randIndividual = (Math.random() * selectCount) >> 0;

            offspring.push(
              new Individual(
                this.individuals[i].dna,
                this.individuals[randIndividual].dna
              )
            );
          }
        }

        if (fittestSurvive) {
          this.individuals.length = selectCount;
          this.individuals = this.individuals.concat(offspring);
        } else {
          this.individuals = offspring;
        }

        this.individuals.length = size;
      } else {
        var parent = this.individuals[0];
        var child = new Individual(parent.dna, parent.dna);

        if (child.fitness > parent.fitness) this.individuals = [child];
      }
    };

    Population.prototype.getFittest = function() {
      return this.individuals.sort(function(a, b) {
        return b.fitness - a.fitness;
      })[0];
    };

    function isRunning() {
      return clock;
    }

    function isPaused() {
      return jiffies && !clock;
    }

    function isStopped() {
      return !isRunning() && !isPaused();
    }

    function fileSelectCb(e) {
      var file = e.target.files[0];

      $("#image-upload-form").submit();

      console.log(file.name);
    }

    function setImage(src) {
      referenceImage.onload = prepareImage;
      referenceImage.src = src;
    }

    function prepareImage() {
      referenceCanvas.width = workingSize;
      referenceCanvas.height = workingSize;

      referenceCtx.drawImage(
        referenceImage,
        0,
        0,
        512,
        512,
        0,
        0,
        workingSize,
        workingSize
      );

      var imageData = referenceCtx.getImageData(0, 0, workingSize, workingSize)
        .data;

      workingData = [];
      var p = workingSize * workingSize * 4;

      for (var i = 0; i < p; i++) {
        workingData[i] = imageData[i];
      }

      referenceCanvas.width = 512;
      referenceCanvas.height = 512;
      referenceCtx.drawImage(referenceImage, 0, 0);
      highestFitness = 0;
      lowestFitness = 100;
    }

    function initConfiguration() {
      $("#population-size-slider").slider({
        range: "min",
        min: 0,
        max: 100,
        step: 1,
        slide: function(event, ui) {
          $("#population-size").text(Math.max(1, ui.value));
        }
      });

      $("#cutoff-slider").slider({
        range: "min",
        min: 1,
        max: 100,
        step: 1,
        slide: function(event, ui) {
          $("#cutoff").text(ui.value + "%");
        }
      });

      $("#mutation-chance-slider").slider({
        range: "min",
        min: 0,
        max: 5,
        step: 0.1,
        slide: function(event, ui) {
          $("#mutation-chance").text(ui.value.toFixed(1) + "%");
        }
      });

      $("#mutation-amount-slider").slider({
        range: "min",
        min: 0,
        max: 100,
        step: 1,
        slide: function(event, ui) {
          $("#mutation-amount").text(ui.value + "%");
        }
      });

      $("#polygons-slider").slider({
        range: "min",
        min: 0,
        max: 500,
        step: 5,
        slide: function(event, ui) {
          $("#polygons").text(Math.max(1, ui.value));
        }
      });

      $("#vertices-slider").slider({
        range: "min",
        min: 1,
        max: 30,
        step: 1,
        slide: function(event, ui) {
          $("#vertices").text(ui.value);
        }
      });

      $("#resolution-slider").slider({
        range: "min",
        min: 0,
        max: 512,
        step: 5,
        slide: function(event, ui) {
          var resolution = Math.max(1, ui.value);

          $("#resolution").text(resolution + "x" + resolution);
        }
      });
    }

    function setConfiguration(
      _populationSize,
      _cutoffSlider,
      _fittestSurvive,
      _mutationChance,
      _mutationAmount,
      _polygons,
      _vertices,
      _resolution,
      _fillPolygons,
      _randomInheritance,
      _diffSquared
    ) {
      if (_populationSize === undefined) var _populationSize = 50;
      $("#population-size-slider").slider("value", _populationSize);
      $("#population-size").text(_populationSize);

      if (_cutoffSlider === undefined) var _cutoffSlider = 15;
      $("#cutoff-slider").slider("value", _cutoffSlider);
      $("#cutoff").text(_cutoffSlider + "%");

      if (_fittestSurvive === undefined) var _fittestSurvive = false;

      if (_mutationChance === undefined) var _mutationChance = 1.0;
      $("#mutation-chance-slider").slider("value", _mutationChance);
      $("#mutation-chance").text(_mutationChance.toFixed(1) + "%");

      if (_mutationAmount === undefined) var _mutationAmount = 10;
      $("#mutation-amount-slider").slider("value", _mutationAmount);
      $("#mutation-amount").text(_mutationAmount + "%");

      if (_polygons === undefined) var _polygons = 5000;
      $("#polygons-slider").slider("value", _polygons);
      $("#polygons").text(_polygons);

      if (_vertices === undefined) var _vertices = 3;
      $("#vertices-slider").slider("value", _vertices);
      $("#vertices").text(_vertices);

      if (_resolution === undefined) var _resolution = 50;
      $("#resolution-slider").slider("value", _resolution);
      $("#resolution").text(_resolution + "x" + _resolution);

      if (_fillPolygons === undefined) var _fillPolygons = true;
      $("#fill-polygons").prop("checked", _fillPolygons);

      if (_randomInheritance === undefined) var _randomInheritance = false;
      $("#random-inheritance").prop("checked", _randomInheritance);

      if (_diffSquared === undefined) var _diffSquared = true;
      $("#diff-squared").prop("checked", _diffSquared);
    }

    function getConfiguration() {
      populationSize = 60;
      selectionCutoff = 0.15;
      fittestSurvive = true;
      mutationChance = 0.1;
      mutateAmount = 0.1;
      polygons = 125;
      vertices = 6;
      workingSize = 512;
      fillPolygons = true;
      randomInheritance = true;
      diffSquared = true;

      geneSize = 4 + vertices * 2;
      dnaLength = polygons * (4 + vertices * 2);

      workingCanvas.width = workingSize;
      workingCanvas.height = workingSize;
      workingCanvas.style.width = workingSize;
      workingCanvas.style.height = workingSize;
    }

    function runSimulation() {
      document.body.classList.remove("genetics-inactive");
      document.body.classList.add("genetics-active");

      if (isPaused()) startTime = new Date().getTime() - resumedTime;

      if (isStopped()) {
        jiffies = 0;
        numberOfImprovements = 0;
        startTime = new Date().getTime();
        population = new Population(populationSize);
      }

      function tick() {
        population.iterate();
        jiffies++;

        var fittest = population.getFittest();
        var totalTime = (new Date().getTime() - startTime) / 1000;
        var timePerGeneration = (totalTime / jiffies) * 1000;
        var timePerImprovment = (totalTime / numberOfImprovements) * 1000;
        var currentFitness = fittest.fitness * 100;

        if (currentFitness > highestFitness) {
          highestFitness = currentFitness;

          numberOfImprovements++;
        } else if (currentFitness < lowestFitness) {
          lowestFitness = currentFitness;
        }

        fittest.draw(outputCtx, 512, 512);

        ap.elapsedTime.text(secondsToString(Math.round(totalTime)));
        ap.numberOfGenerations.text(jiffies);
        ap.timePerGeneration.text(timePerGeneration.toFixed(2) + " ms");
        ap.timePerImprovment.text(timePerImprovment.toFixed(2) + " ms");
        ap.currentFitness.text(currentFitness.toFixed(2) + "%");
        ap.highestFitness.text(highestFitness.toFixed(2) + "%");
        ap.lowestFitness.text(lowestFitness.toFixed(2) + "%");
      }

      clock = setInterval(tick, 0);
    }

    function startSimulation() {
      if (isStopped()) {
        getConfiguration();
        prepareImage();
      }

      $(".conf-slider").slider("option", "disabled", true);
      $('input[type="checkbox"]').attr("disabled", true);
      $("#start").text("Pause");
      $(".results-btn").attr("disabled", "disabled");
      runSimulation();
    }

    function pauseSimulation() {
      clearInterval(clock);
      clock = null;
      resumedTime = new Date().getTime() - startTime;
      $("#start").text("Resume");
      $(".results-btn").removeAttr("disabled");
    }

    function stopSimulation() {
      clearInterval(clock);
      clock = null;
      jiffies = null;
      startTime = null;
      population = null;
      highestFitness = 0;
      lowestFitness = 100;
      resumedTime = 0;
      $("#elapsed-time").text("0:00");
      $(".conf-slider").slider("option", "disabled", false);
      $('input[type="checkbox"]').attr("disabled", false);
      $(".results-btn").attr("disabled", "disabled");

      document.body.classList.remove("genetics-active");
      document.body.classList.add("genetics-inactive");

      outputCtx.clearRect(0, 0, 512, 512);
      workingCtx.clearRect(0, 0, workingSize, workingSize);

      $("#start").text("Start");
    }

    $("#stock-image-menu li a").click(function() {
      setImage(
        "/images/genetics/" +
          $(this)
            .text()
            .toLowerCase()
            .replace(/ /g, "-") +
          ".jpg"
      );
    });

    $("#start").click(function() {
      if (isRunning()) {
        pauseSimulation();
      } else {
        startSimulation();
      }
    });

    $("#stop").click(function() {
      if (isRunning() || isPaused()) {
        stopSimulation();
      }
    });

    $("#get-url").click(function() {
      var urlBox = $("#share-url")[0];

      var location = "https:";

      urlBox.value = location + "#" + configurationToString();
      $("#share").show();
      urlBox.focus();
      urlBox.select();
      urlBox.setSelectionRange(0, 250);
    });

    $("#close-url").click(function() {
      $("#share").hide();
    });

    $("#save-png").click(function() {
      window.open(outputCanvas.toDataURL());
    });

    function configurationFromString(str) {
      var args = str.split("&");

      try {
        var _populationSize = parseInt(args[0]);
        var _cutoffSlider = parseInt(args[1]);
        var _fittestSurvive = args[2] ? true : false;
        var _mutationChance = parseFloat(args[3]);
        var _mutationAmount = parseInt(args[4]);
        var _polygons = parseInt(args[5]);
        var _vertices = parseInt(args[6]);
        var _resolution = parseInt(args[7]);
        var _fillPolygons = args[8] ? true : false;
        var _randomInheritance = args[9] ? true : false;
        var _diffSquared = args[10] ? true : false;

        setConfiguration(
          _populationSize,
          _cutoffSlider,
          _fittestSurvive,
          _mutationChance,
          _mutationAmount,
          _polygons,
          _vertices,
          _resolution,
          _fillPolygons,
          _randomInheritance,
          _diffSquared
        );
      } catch (e) {}
    }

    function configurationToString() {
      return (
        populationSize +
        "&" +
        selectionCutoff * 100 +
        "&" +
        (fittestSurvive ? 1 : 0) +
        "&" +
        mutationChance * 100 +
        "&" +
        mutateAmount * 100 +
        "&" +
        polygons +
        "&" +
        vertices +
        "&" +
        workingSize +
        "&" +
        (fillPolygons ? 1 : 0) +
        "&" +
        (randomInheritance ? 1 : 0) +
        "&" +
        (diffSquared ? 1 : 0)
      );
    }

    $("#get-in-touch").click(function() {
      $(".feedback-overlay").fadeIn("slow");
      $(".feedback-form").fadeIn("fast");
    });

    this.init = function() {
      outputCanvas = $("#outputCanvas")[0];
      outputCtx = outputCanvas.getContext("2d");

      workingCanvas = $("#workingCanvas")[0];
      workingCtx = workingCanvas.getContext("2d");

      referenceImage = $("#referenceImage")[0];
      referenceCanvas = $("#referenceCanvas")[0];
      referenceCtx = referenceCanvas.getContext("2d");

      ap = {
        elapsedTime: $("#elapsed-time"),
        numberOfGenerations: $("#number-of-generations"),
        timePerGeneration: $("#time-per-generation"),
        timePerImprovment: $("#time-per-improvement"),
        currentFitness: $("#current-fitness"),
        highestFitness: $("#highest-fitness"),
        lowestFitness: $("#lowest-fitness")
      };

      if (!isSupported()) alert("Unable to run genetics program!");

      initConfiguration();
      setConfiguration();
      getConfiguration();
      prepareImage();

      $(".conf-option").tooltip("hide");
      $("#start").attr("disabled", false);
      $("#stop").attr("disabled", false);

      if (location.hash.split("&").length > 5)
        configurationFromString(location.hash.replace(/#/, ""));
    };
  }.call(GeneticPolygon)
);

/**
 * Bootstrap the page with our initialisation code.
 */
window.onload = GeneticPolygon.init;
