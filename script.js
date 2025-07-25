// Инициализация карты (центр - Екатеринбург)
const map = L.map('map').setView([56.845, 60.609], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Элементы DOM
const uploadButton = document.getElementById('upload-button');
const photoUpload = document.getElementById('photo-upload');
const photoList = document.getElementById('photo-list');
const sidebar = document.getElementById('sidebar');

// Хранилище для фото и маркеров
const photos = [];

// Открытие файлового диалога по кнопке
uploadButton.addEventListener('click', () => {
    photoUpload.click();
});

// Обработчик загрузки фото
photoUpload.addEventListener('change', function(e) {
    const files = e.target.files;
    
    for (const file of files) {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const img = new Image();
            
            img.onload = function() {
                // Чтение EXIF данных
                EXIF.getData(img, function() {
                    const exifData = EXIF.getAllTags(this);
                    
                    if (exifData?.GPSLatitude && exifData?.GPSLongitude) {
                        // Конвертация координат из EXIF в градусы
                        const lat = convertExifGps(exifData.GPSLatitude, exifData.GPSLatitudeRef);
                        const lon = convertExifGps(exifData.GPSLongitude, exifData.GPSLongitudeRef);
                        
                        // Добавление маркера и фото в список
                        addPhoto(lat, lon, event.target.result, file.name);
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

// Конвертация EXIF GPS в десятичные градусы
function convertExifGps(coords, ref) {
    const degrees = coords[0] + coords[1]/60 + coords[2]/3600;
    return (ref === 'S' || ref === 'W') ? -degrees : degrees;
}

// Добавление фото на карту и в список
function addPhoto(lat, lon, photoUrl, fileName) {
    // Создаем уникальный ID для фото
    const photoId = 'photo-' + Date.now();
    
    // Добавляем маркер на карту
    const marker = L.marker([lat, lon], { 
        photoId: photoId,
        riseOnHover: true
    }).addTo(map);
    
    marker.bindPopup(`
        <div class="photo-popup">
            <img src="${photoUrl}" alt="${fileName}">
            <p>Координаты: ${lat.toFixed(6)}, ${lon.toFixed(6)}</p>
        </div>
    `);
    
    // Добавляем фото в боковую панель
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.id = photoId;
    photoItem.innerHTML = `
        <img src="${photoUrl}" alt="${fileName}">
        <p>${fileName}</p>
        <p>Координаты: ${lat.toFixed(6)}, ${lon.toFixed(6)}</p>
    `;
    
    // При клике на фото в списке - центрируем карту на этом месте
    photoItem.addEventListener('click', () => {
        map.setView([lat, lon], 15);
        marker.openPopup();
        // Подсвечиваем выбранный элемент
        document.querySelectorAll('.photo-item').forEach(item => {
            item.style.background = 'white';
        });
        photoItem.style.background = '#e6f7ff';
    });
    
    photoList.appendChild(photoItem);
    
    // Сохраняем данные о фото
    photos.push({
        id: photoId,
        lat: lat,
        lon: lon,
        url: photoUrl,
        name: fileName,
        marker: marker
    });
}
