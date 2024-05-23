document.addEventListener("DOMContentLoaded", async function() {
    const loadingScreen = document.getElementById('loadingScreen');
    
    Cesium.Ion.defaultAccessToken = CONFIG.CESIUM_ACCESS_TOKEN;

    const viewer = new Cesium.Viewer("cesiumContainer", { 
        shouldAnimate: true,
        geocoder: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        homeButton: true
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.sun = new Cesium.Sun();
    viewer.scene.moon = new Cesium.Moon();

    let dataSource;
    let highlightedEntity = null;
    try {
        const resource = await Cesium.IonResource.fromAssetId(CONFIG.ASSET_ID);
        dataSource = await Cesium.CzmlDataSource.load(resource);
        await viewer.dataSources.add(dataSource);        
        viewer.clock.multiplier = 1;
        const step = 10;

        const animationViewModel = viewer.animation.viewModel;
        animationViewModel.playForwardViewModel.command.beforeExecute.addEventListener(function(commandInfo) {
            viewer.clock.multiplier += step;
        });

        animationViewModel.playReverseViewModel.command.beforeExecute.addEventListener(function(commandInfo) {
            viewer.clock.multiplier -= step;
        });
        
        loadingScreen.style.display = 'none';

        // Display search box after loading screen is hidden
        const searchContainer = document.getElementById('searchContainer');
        searchContainer.style.display = 'block';
    } catch (error) {
        console.log(error);
    }

    const infoBox = document.getElementById("infoBox");

    viewer.screenSpaceEventHandler.setInputAction(function onLeftClick(movement) {
        const pickedObject = viewer.scene.pick(movement.position);
        if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
            const entity = pickedObject.id;
            displayInfoBox(entity);
            highlightEntityPath(entity);
            highlightedEntity = entity;
        } else {
            infoBox.style.display = 'none';
            if (highlightedEntity) {
                removeEntityPath(highlightedEntity);
                highlightedEntity = null;
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    function displayInfoBox(entity) {
        const description = entity.properties.description?.getValue(Cesium.JulianDate.now());
        const S_D = entity.properties.S_D?.getValue(Cesium.JulianDate.now());
        const S_I = entity.properties.S_I?.getValue(Cesium.JulianDate.now());
        const S_T = entity.properties.S_T?.getValue(Cesium.JulianDate.now());
        const DIT = entity.properties.DIT?.getValue(Cesium.JulianDate.now());

        infoBox.style.display = 'block';
        infoBox.innerHTML = `<strong>NORAD CAT ID:</strong> <span>${entity.id}</span>
                             <strong>NAME:</strong> <span>${entity.name}</span>
                             <strong>Detectability:</strong> <span>${S_D}</span>
                             <strong>Identifiability:</strong> <span>${S_I}</span>
                             <strong>Trackability:</strong> <span>${S_T}</span>
                             <strong>DIT:</strong> <span>${DIT}</span>`;
    }

    function highlightEntityPath(entity) {
        entity.path = new Cesium.PathGraphics({
            leadTime: 0,
            trailTime: 60 * 60 * 24,
            width: 1,
            material: Cesium.Color.WHITE
        });
        viewer.entities.add(entity);
    }

    function removeEntityPath(entity) {
        entity.path = undefined;
        viewer.entities.remove(entity);
    }

    function updateColors(property, numberOfBins = 5) {
        let minValue = Infinity;
        let maxValue = -Infinity;
        let hasValues = false;

        dataSource.entities.values.forEach(entity => {
            const value = entity.properties[property]?.getValue(Cesium.JulianDate.now());
            if (value !== undefined) {
                hasValues = true;
                if (value < minValue) minValue = value;
                if (value > maxValue) maxValue = value;
            }
        });

        if (!hasValues) {
            removeLegend();
            return;
        }

        const binSize = (maxValue - minValue) / numberOfBins;
        const bins = [];
        for (let i = 0; i < numberOfBins; i++) {
            bins.push({
                min: minValue + i * binSize,
                max: minValue + (i + 1) * binSize,
                color: Cesium.Color.fromHsl(i / numberOfBins, 1.0, 0.5, 1.0)
            });
        }

        function getColor(value) {
            for (let bin of bins) {
                if (value >= bin.min && value <= bin.max) {
                    return bin.color;
                }
            }
            return Cesium.Color.WHITE;
        }

        dataSource.entities.values.forEach(entity => {
            const value = entity.properties[property]?.getValue(Cesium.JulianDate.now());
            if (value !== undefined && entity.point) {
                const color = getColor(value);
                entity.point.color = color;
            }
        });

        generateLegend(bins);
    }

    function generateLegend(bins) {
        removeLegend();

        const legendContainer = document.createElement('div');
        legendContainer.style.position = 'absolute';
        legendContainer.style.bottom = '70px';
        legendContainer.style.right = '10px';
        legendContainer.style.padding = '15px';
        legendContainer.style.backgroundColor = 'hsl(0, 0%, 99%)';
        legendContainer.style.border = '1px solid hsl(0, 1%, 58%)';
        legendContainer.style.borderRadius = '10px';
        legendContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        legendContainer.style.fontFamily = 'Arial, sans-serif';
        legendContainer.style.fontSize = '14px';
        legendContainer.style.color = '#0a0a0a';
        legendContainer.style.zIndex = '1000';
        legendContainer.id = 'legendContainer';

        bins.forEach(bin => {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.marginBottom = '10px';

            const colorBox = document.createElement('div');
            colorBox.style.width = '20px';
            colorBox.style.height = '20px';
            colorBox.style.backgroundColor = bin.color.toCssColorString();
            colorBox.style.border = '1px solid #000';
            colorBox.style.marginRight = '10px';

            const label = document.createElement('span');
            label.textContent = `${bin.min.toFixed(2)} - ${bin.max.toFixed(2)}`;

            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);

            legendContainer.appendChild(legendItem);
        });

        document.body.appendChild(legendContainer);
    }

    function removeLegend() {
        const existingLegend = document.getElementById('legendContainer');
        if (existingLegend) {
            existingLegend.remove();
        }
    }
    updateColors('DIT', 5);
    document.querySelector('input[value="DIT"]').checked = true;

    document.querySelectorAll('input[name="property"]').forEach(radio => {
        radio.addEventListener('change', event => {
            updateColors(event.target.value);
        });
    });

    document.getElementById('reset').addEventListener('click', () => {
        document.querySelectorAll('input[name="property"]').forEach(radio => {
            radio.checked = false;
        });
        dataSource.entities.values.forEach(entity => {
            if (entity.point) {
                entity.point.color = Cesium.Color.YELLOW.withAlpha(1);
            }
        });
        removeLegend();
    });

    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');

    function performSearch() {
        const searchId = searchInput.value.trim();
        if (searchId) {
            const entity = dataSource.entities.getById(searchId);
            if (entity) {
                if (highlightedEntity) {
                    removeEntityPath(highlightedEntity);
                }

                highlightEntityPath(entity);
                highlightedEntity = entity;

                viewer.flyTo(entity).then(() => {
                    displayInfoBox(entity);
                });
            } else {
                alert('Entity not found.');
            }
        }
    }

    searchButton.addEventListener('click', performSearch);

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });

    const homeButton = viewer.homeButton.viewModel.command;
    homeButton.afterExecute.addEventListener(function() {
        if (highlightedEntity) {
            removeEntityPath(highlightedEntity);
            highlightedEntity = null;
            infoBox.style.display = 'none';
        }
    });
});

