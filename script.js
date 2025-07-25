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
                        
                        // Проверка на дубликаты
                        if (!isDuplicatePhoto(lat, lon)) {
                            // Добавление маркера и фото в список
                            addPhoto(lat, lon, event.target.result, file.name);
                        } else {
                            alert(`Фото "${file.name}" не было добавлено, так как фото с такими координатами уже существует!`);
                        }
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

// Проверка на дубликаты по координатам
function isDuplicatePhoto(lat, lon) {
    // Погрешность в 0.0001 градуса (~11 метров)
    const precision = 0.0001;
    
    return photos.some(photo => {
        return Math.abs(photo.lat - lat) < precision && 
               Math.abs(photo.lon - lon) < precision;
    });
}

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
        
        // На мобильных устройствах скрываем боковую панель после выбора
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
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

// Управление боковой панелью на мобильных устройствах
menuButton.addEventListener('click', () => {
    sidebar.classList.add('active');
});

closeSidebar.addEventListener('click', () => {
    sidebar.classList.remove('active');
});

// Закрытие боковой панели при клике на карту (для мобильных)
map.on('click', () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
});

// Адаптация при изменении размера окна
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.add('active');
    } else {
        sidebar.classList.remove('active');
    }
});