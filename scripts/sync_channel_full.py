"""
Скрипт для синхронизации всех участников канала с базой данных
Использует Telethon (MTProto API) для получения полного списка участников

Требования:
- pip install telethon asyncpg
- API_ID и API_HASH от https://my.telegram.org/apps
"""

import asyncio
import os
import sys
from datetime import datetime
from telethon import TelegramClient
from telethon.tl.functions.channels import GetParticipantsRequest
from telethon.tl.types import ChannelParticipantsSearch
import asyncpg
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Конфигурация Telegram
API_ID = os.getenv('TELEGRAM_API_ID')  # Добавьте в .env
API_HASH = os.getenv('TELEGRAM_API_HASH')  # Добавьте в .env
PHONE = os.getenv('TELEGRAM_PHONE')  # Ваш номер телефона
CHANNEL_ID = int(os.getenv('CHANNEL_ID', '-1003216850856'))

# Конфигурация БД
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:tbswlvQbgFmiOdcJPKyAckRuSmvrYxxw@nozomi.proxy.rlwy.net:35365/railway')


class ChannelSyncService:
    def __init__(self):
        self.client = None
        self.db = None
        self.stats = {
            'total_members': 0,
            'known_users': 0,
            'marked_as_paid': 0,
            'already_paid': 0,
            'new_friends': 0,
            'errors': []
        }

    async def connect_telegram(self):
        """Подключение к Telegram"""
        if not API_ID or not API_HASH or not PHONE:
            raise ValueError(
                "Необходимо указать TELEGRAM_API_ID, TELEGRAM_API_HASH и TELEGRAM_PHONE в .env файле\n"
                "Получите API_ID и API_HASH на https://my.telegram.org/apps"
            )
        
        self.client = TelegramClient('channel_sync_session', int(API_ID), API_HASH)
        await self.client.start(phone=PHONE)
        print("✅ Подключено к Telegram")

    async def connect_database(self):
        """Подключение к базе данных"""
        self.db = await asyncpg.connect(DATABASE_URL)
        print("✅ Подключено к базе данных")

    async def get_channel_members(self):
        """Получить всех участников канала"""
        members = []
        offset = 0
        limit = 200
        
        print(f"🔍 Получаю участников канала {CHANNEL_ID}...")
        
        try:
            while True:
                participants = await self.client(GetParticipantsRequest(
                    channel=CHANNEL_ID,
                    filter=ChannelParticipantsSearch(''),
                    offset=offset,
                    limit=limit,
                    hash=0
                ))
                
                if not participants.users:
                    break
                
                for user in participants.users:
                    if not user.bot:  # Пропускаем ботов
                        members.append({
                            'user_id': user.id,
                            'username': user.username,
                            'first_name': user.first_name,
                            'last_name': user.last_name,
                        })
                
                offset += len(participants.users)
                print(f"  Загружено {offset} участников...")
                
                # Если получили меньше чем limit, значит это последняя страница
                if len(participants.users) < limit:
                    break
            
            print(f"✅ Всего найдено участников: {len(members)}")
            return members
            
        except Exception as e:
            print(f"❌ Ошибка при получении участников: {e}")
            raise

    async def sync_member(self, member):
        """Синхронизировать одного участника"""
        try:
            # Проверяем, есть ли пользователь в таблице users
            user = await self.db.fetchrow(
                'SELECT "userId", "hasPaid" FROM users WHERE "userId" = $1',
                member['user_id']
            )
            
            if user:
                # Пользователь есть в боте
                self.stats['known_users'] += 1
                
                if not user['hasPaid']:
                    # Помечаем как оплатившего
                    await self.db.execute(
                        '''
                        UPDATE users 
                        SET "hasPaid" = true, 
                            "paidAt" = COALESCE("paidAt", NOW()),
                            "currentStep" = 'completed'
                        WHERE "userId" = $1
                        ''',
                        member['user_id']
                    )
                    self.stats['marked_as_paid'] += 1
                    print(f"  ✅ {member['username'] or member['first_name']} ({member['user_id']}) помечен как оплативший")
                else:
                    self.stats['already_paid'] += 1
            else:
                # Пользователя нет в боте - добавляем в friends
                existing_friend = await self.db.fetchrow(
                    'SELECT "userId" FROM friends WHERE "userId" = $1',
                    member['user_id']
                )
                
                if not existing_friend:
                    await self.db.execute(
                        '''
                        INSERT INTO friends ("userId", username, "firstName", "lastName", notes)
                        VALUES ($1, $2, $3, $4, $5)
                        ''',
                        member['user_id'],
                        member['username'],
                        member['first_name'],
                        member['last_name'],
                        'Добавлен через синхронизацию канала (Python MTProto)'
                    )
                    self.stats['new_friends'] += 1
                    print(f"  ➕ {member['username'] or member['first_name']} ({member['user_id']}) добавлен в friends")
                    
        except Exception as e:
            error_msg = f"Ошибка при обработке {member['user_id']}: {e}"
            self.stats['errors'].append(error_msg)
            print(f"  ❌ {error_msg}")

    async def sync_all_members(self):
        """Синхронизировать всех участников"""
        print("\n🔄 Начинаю синхронизацию участников канала...\n")
        
        # Получаем список участников
        members = await self.get_channel_members()
        self.stats['total_members'] = len(members)
        
        print(f"\n📊 Обрабатываю {len(members)} участников...\n")
        
        # Обрабатываем каждого участника
        for i, member in enumerate(members, 1):
            if i % 50 == 0:
                print(f"  Обработано {i}/{len(members)}...")
            await self.sync_member(member)
        
        print("\n✅ Синхронизация завершена!\n")

    def print_report(self):
        """Вывести отчет о синхронизации"""
        print("=" * 60)
        print("📊 ОТЧЕТ О СИНХРОНИЗАЦИИ КАНАЛА")
        print("=" * 60)
        print(f"👥 Всего участников: {self.stats['total_members']}")
        print(f"✅ Известных пользователей: {self.stats['known_users']}")
        print(f"💰 Помечено как оплативших: {self.stats['marked_as_paid']}")
        print(f"✔️  Уже были оплачены: {self.stats['already_paid']}")
        print(f"👤 Новых friends добавлено: {self.stats['new_friends']}")
        
        if self.stats['errors']:
            print(f"\n⚠️  Ошибки ({len(self.stats['errors'])}):")
            for error in self.stats['errors'][:10]:
                print(f"  - {error}")
            if len(self.stats['errors']) > 10:
                print(f"  ... и еще {len(self.stats['errors']) - 10} ошибок")
        
        print("=" * 60)

    async def run(self):
        """Запустить синхронизацию"""
        try:
            await self.connect_telegram()
            await self.connect_database()
            await self.sync_all_members()
            self.print_report()
        finally:
            if self.db:
                await self.db.close()
            if self.client:
                await self.client.disconnect()


async def main():
    service = ChannelSyncService()
    await service.run()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Синхронизация прервана пользователем")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        sys.exit(1)
