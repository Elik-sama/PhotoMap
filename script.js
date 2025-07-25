// Инициализация карты (центр - Екатеринбург)
const map = L.map('map').setView([56.845, 60.609], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Элементы DOM
const uploadButton = document.getElementById('upload-button');
const photoUpload = document.getElementById('photo-upload');
const photoList = document.getElementById('photo-list');
const menuButton = document.getElementById('menu-button');
const closeSidebar = document.getElementById('close-sidebar');
const sidebar = document.getElementById('sidebar');

// Хранилище для текущих фото
let currentPhotos = [];

// Обработчик загрузки фото
photoUpload.addEventListener('change', function(e) {
    const files = e.target.files;
    
    for (const file of files) {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const img = new Image();
            
            img.onload = function() {
                EXIF.getData(img, function() {
                    const exifData = EXIF.getAllTags(this);
                    
                    if (exifData?.GPSLatitude && exifData?.GPSLongitude) {
                        const lat = convertExifGps(exifData.GPSLatitude, exifData.GPSLatitudeRef);
                        const lon = convertExifGps(exifData.GPSLongitude, exifData.GPSLongitudeRef);
                        
                        const photo = {
                            id: Date.now(), // Уникальный ID для фото
                            lat: lat,
                            lon: lon,
                            url: event.target.result,
                            name: file.name
                        };
                        
                        addPhoto(photo);
                    } else {
                        alert(`Фото "${file.name}" не содержит геоданных!`);
                    }
                });
            };
            
            img.src = event.target.result;
        };
        
        reader.readAsDataURL(file);
    }
});

// Добавление фото на карту и в список
function addPhoto(photo) {
    // Добавляем маркер на карту
    const marker = L.marker([photo.lat, photo.lon], {
        riseOnHover: true
    }).addTo(map);
    
    marker.bindPopup(`
        <div class="photo-popup">
            <img src="${photo.url}" alt="${photo.name}">
            <p>${photo.name}</p>
            <p>Координаты: ${photo.lat.toFixed(6)}, ${photo.lon.toFixed(6)}</p>
            <button class="delete-popup" data-id="${photo.id}">Удалить</button>
        </div>
    `);
    
    // Добавляем фото в боковую панель
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.dataset.id = photo.id;
    
    photoItem.innerHTML = `
        <img src="${photo.url}" alt="${photo.name}">
        <div class="photo-info">
            <p>${photo.name}</p>
            <p>Координаты: ${photo.lat.toFixed(6)}, ${photo.lon.toFixed(6)}</p>
        </div>
        <button class="delete-photo" title="Удалить фото" data-id="${photo.id}">×</button>
    `;
    
    // Обработчик клика по фото
    photoItem.querySelector('.photo-info').addEventListener('click', () => {
        map.setView([photo.lat, photo.lon], 15);
        marker.openPopup();
        highlightPhotoItem(photoItem);
        
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
    });
    
    // Обработчик удаления
    const deleteButton = photoItem.querySelector('.delete-photo');
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        removePhoto(photo.id);
    });
    
    photoList.appendChild(photoItem);
    
    // Сохраняем ссылки на элементы для удаления
    currentPhotos.push({
        ...photo,
        marker: marker,
        element: photoItem
    });
    
    // Обработчик удаления из popup
    marker.on('popupopen', () => {
        document.querySelector(`.delete-popup[data-id="${photo.id}"]`)
            ?.addEventListener('click', () => {
                removePhoto(photo.id);
                map.closePopup();
            });
    });
}

// Удаление фото
function removePhoto(photoId) {
    if (confirm('Вы уверены, что хотите удалить это фото?')) {
        const photoIndex = currentPhotos.findIndex(p => p.id === photoId);
        if (photoIndex !== -1) {
            const photo = currentPhotos[photoIndex];
            
            // Удаляем маркер с карты
            map.removeLayer(photo.marker);
            
            // Удаляем элемент из списка
            photo.element.remove();
            
            // Удаляем из массива
            currentPhotos.splice(photoIndex, 1);
        }
    }
}

// Конвертация EXIF координат
function convertExifGps(coords, ref) {
    const degrees = coords[0] + coords[1]/60 + coords[2]/3600;
    return (ref === 'S' || ref === 'W') ? -degrees : degrees;
}

// Подсветка выбранного фото
function highlightPhotoItem(item) {
    document.querySelectorAll('.photo-item').forEach(i => {
        i.style.background = 'white';
    });
    item.style.background = '#e6f7ff';
}

// Управление боковой панелью
menuButton.addEventListener('click', () => {
    sidebar.classList.add('active');
});

closeSidebar.addEventListener('click', () => {
    sidebar.classList.remove('active');
});

map.on('click', () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.add('active');
    } else {
        sidebar.classList.remove('active');
    }
});

// Открытие файлового диалога по кнопке
uploadButton.addEventListener('click', () => {
    photoUpload.click();
});