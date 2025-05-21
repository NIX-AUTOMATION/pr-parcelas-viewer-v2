// Inicializar el mapa
const map = L.map('map').setView([18.2208, -66.5901], 9); // Coordenadas centradas en Puerto Rico

// Añadir capa de mapa base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Variables globales
let currentParcelas = [];
let parcelasLayer = L.layerGroup().addTo(map);
let selectedParcela = null;

// Convertir coordenadas EPSG:102100 (Web Mercator) a coordenadas geográficas (EPSG:4326)
function webMercatorToLatLng(x, y) {
    const earthRadius = 6378137; // Radio de la Tierra en metros
    
    // Convertir coordenadas Web Mercator a Lat/Lng
    const lng = (x / earthRadius) * (180 / Math.PI);
    const lat = ((Math.PI / 2) - (2 * Math.atan(Math.exp(-y / earthRadius)))) * (180 / Math.PI);
    
    return [lat, lng];
}

// Función para transformar los anillos de coordenadas
function transformRings(rings) {
    if (!rings || !rings.length) return [];
    
    return rings.map(ring => {
        return ring.map(coord => {
            return webMercatorToLatLng(coord[0], coord[1]);
        });
    });
}

// Cargar archivo JSON de parcelas
async function loadParcelas(filename) {
    if (!filename) return;
    
    try {
        document.body.style.cursor = 'wait';
        const response = await fetch(filename);
        const data = await response.json();
        currentParcelas = data;
        
        // Limpiar el mapa
        parcelasLayer.clearLayers();
        
        // Mostrar las parcelas en el mapa
        renderParcelas(data);
        
        document.body.style.cursor = 'default';
    } catch (error) {
        console.error('Error al cargar las parcelas:', error);
        alert('Error al cargar el archivo de parcelas');
        document.body.style.cursor = 'default';
    }
}

// Renderizar parcelas en el mapa
function renderParcelas(parcelas) {
    // Si hay muchas parcelas (más de 1000), mostrar advertencia
    if (parcelas.length > 1000) {
        const confirmar = confirm(`Este archivo contiene ${parcelas.length} parcelas. Mostrar todas puede ralentizar el navegador. ¿Desea continuar?`);
        if (!confirmar) return;
    }
    
    // Límite para evitar bloquear el navegador
    const limite = 5000;
    const parcelasToRender = parcelas.slice(0, limite);
    
    if (parcelas.length > limite) {
        alert(`Se mostrarán solo las primeras ${limite} parcelas para evitar ralentizar el navegador.`);
    }
    
    // Añadir parcelas al mapa
    parcelasToRender.forEach(parcela => {
        try {
            if (parcela.coordenadas && parcela.coordenadas.length > 0) {
                const transformedRings = transformRings(parcela.coordenadas);
                
                const polygon = L.polygon(transformedRings, {
                    color: 'blue',
                    fillColor: '#3388ff',
                    fillOpacity: 0.2,
                    weight: 1
                });
                
                polygon.parcela = parcela;
                polygon.on('click', onParcelaClick);
                parcelasLayer.addLayer(polygon);
            }
        } catch (error) {
            console.error(`Error al renderizar parcela ${parcela.id}:`, error);
        }
    });
    
    // Ajustar la vista a las parcelas si hay alguna
    if (parcelasLayer.getLayers().length > 0) {
        map.fitBounds(parcelasLayer.getBounds());
    }
}

// Manejar click en parcela
function onParcelaClick(e) {
    const parcela = e.target.parcela;
    
    // Restablecer estilo de la parcela previamente seleccionada
    if (selectedParcela) {
        selectedParcela.setStyle({
            color: 'blue',
            fillColor: '#3388ff',
            fillOpacity: 0.2,
            weight: 1
        });
    }
    
    // Establecer estilo para la parcela seleccionada
    selectedParcela = e.target;
    selectedParcela.setStyle({
        color: 'red',
        fillColor: 'red',
        fillOpacity: 0.3,
        weight: 2
    });
    
    // Mostrar información de la parcela
    showParcelaInfo(parcela);
}

// Mostrar información de la parcela en el panel lateral
function showParcelaInfo(parcela) {
    const infoPanel = document.getElementById('parcela-info');
    
    // Crear tabla HTML para mostrar los atributos
    let html = `<h3>ID: ${parcela.id}</h3>`;
    
    if (parcela.atributos) {
        html += '<table>';
        
        // Obtener todas las propiedades del objeto atributos
        const atributos = Object.entries(parcela.atributos);
        
        // Mostrar los atributos en la tabla
        atributos.forEach(([key, value]) => {
            // Formatear valores null o undefined
            const displayValue = value === null || value === undefined ? '-' : value;
            html += `
                <tr>
                    <th>${key}</th>
                    <td>${displayValue}</td>
                </tr>
            `;
        });
        
        html += '</table>';
    } else {
        html += '<p>No hay información detallada disponible para esta parcela.</p>';
    }
    
    infoPanel.innerHTML = html;
}

// Buscar parcela por ID
function searchParcelaById(id) {
    const parcela = currentParcelas.find(p => p.id === parseInt(id));
    
    if (parcela) {
        // Encontrar el polígono correspondiente
        parcelasLayer.eachLayer(layer => {
            if (layer.parcela && layer.parcela.id === parseInt(id)) {
                // Simular clic en la parcela
                onParcelaClick({ target: layer });
                
                // Centrar el mapa en la parcela
                if (layer.getBounds) {
                    map.fitBounds(layer.getBounds());
                }
            }
        });
    } else {
        alert(`No se encontró ninguna parcela con ID ${id} en el conjunto de datos actual.`);
    }
}

// Event Listeners
document.getElementById('file-select').addEventListener('change', (e) => {
    loadParcelas(e.target.value);
});

document.getElementById('search-btn').addEventListener('click', () => {
    const searchId = document.getElementById('search-id').value.trim();
    if (searchId) {
        searchParcelaById(searchId);
    }
});

// También buscar al presionar Enter en el campo de búsqueda
document.getElementById('search-id').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const searchId = e.target.value.trim();
        if (searchId) {
            searchParcelaById(searchId);
        }
    }
});

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Mensaje de bienvenida
    console.log('Visor de Parcelas Catastro - Listo para usar');
    
    // Cargar automáticamente el primer archivo si está disponible
    const fileSelect = document.getElementById('file-select');
    if (fileSelect.options.length > 1) {
        fileSelect.selectedIndex = 1; // Seleccionar el primer archivo
        loadParcelas(fileSelect.value);
    }
}); 