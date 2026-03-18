# Maria database 설치 및 SQL 연습

## 0. 전제: Colab에서 MariaDB를 쓸 때 반드시 알아야 할 점

1. **Colab은 임시 VM**이라서 런타임이 종료되면 서버/데이터가 초기화됩니다.

   * 즉, MariaDB도 “설치”는 가능하지만 세션이 끝나면 다시 설치/실행해야 합니다.
2. MariaDB는 **서버 프로세스(mariadbd)** 가 떠 있어야 접속이 됩니다.
3. Colab은 기본적으로 **root 계정이 비밀번호 없이 로컬 접속**되도록 설정되는 경우가 많습니다(패키지 기본 설정).

---

## 1. 패키지 목록 업데이트

왜 필요하나?

* `apt install`은 패키지 저장소 정보를 기반으로 설치합니다.
* Colab VM은 새로 뜰 때마다 저장소 인덱스가 최신이 아닐 수 있어서 먼저 업데이트하는 게 안전합니다.

```bash
apt update -y
```

---

## 2. MariaDB 서버 설치

왜 `mariadb-server`를 설치하나?

* 클라이언트(`mariadb`)만 설치하면 “접속 도구”만 생기고 서버가 없습니다.
* `mariadb-server`는 서버 데몬과 클라이언트 도구를 함께 설치합니다.

```bash
sudo apt install -y mariadb-server
```

설치 확인(버전 확인):

```bash
mariadb --version
```

---

## 3. MariaDB 서버 시작

왜 필요하나?

* MariaDB는 단순 프로그램이 아니라 “항상 켜져 있는 서버”입니다.
* 설치만 하면 서버가 자동으로 뜨지 않는 경우가 많아서 직접 시작해야 합니다.

```bash
sudo service mariadb start
```

상태 확인:

```bash
service mariadb status
```

정상이라면 상태에 `active (running)` 같은 표시가 나옵니다.

추가 확인(프로세스 확인):

```bash
ps aux | grep -E "mariadbd|mysqld" | grep -v grep
```

---

## 4. root로 접속 (로컬)

왜 root로 접속하나?

* 초기 설정, DB 생성, 사용자 생성 같은 관리 작업은 권한이 필요합니다.

```bash
sudo mysql -u root -p
```

접속되면 프롬프트가 바뀝니다:

```
MariaDB [(none)]>
```

---

## 5. 기본 점검 쿼리

현재 서버가 정상인지, 기본 DB가 있는지 확인합니다.

```sql
SELECT VERSION();
SHOW DATABASES;
SELECT USER(), CURRENT_USER();
```

* `USER()`는 접속한 사용자(인증 주체)
* `CURRENT_USER()`는 권한 평가에 사용되는 사용자(권한 주체)

---

## 6. 실습용 DB와 사용자 생성

왜 사용자 계정을 따로 만드나?

* root로 모든 작업을 하면 실습 환경에서 실수 위험이 큽니다.
* 실습용 사용자로 권한을 분리하는 것이 운영 관점에서 기본 습관입니다.

아래는 `testdb` 데이터베이스와 `testuser` 계정을 만들고, `testdb`에 대한 권한만 부여합니다.

```sql
CREATE DATABASE testdb CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE testdb;

CREATE USER 'testuser'@'localhost' IDENTIFIED BY '1234';

GRANT ALL PRIVILEGES ON testdb.* TO 'testuser'@'localhost';

FLUSH PRIVILEGES;
```

확인:

```sql
SHOW GRANTS FOR 'testuser'@'localhost';
```

root 세션 종료:

```sql
EXIT;
```
## 6.1 사용자 추가
1. root 계정으로 접속
먼저 관리자 권한으로 DB에 접속해야 합니다.

```sql
sudo mysql -u root -p
```
2. 사용자 생성 및 권한 부여
다음 SQL 명령어를 순차적으로 입력합니다. (예: 사용자명 newuser, 비밀번호 5678)

```sql
-- 1. 사용자 생성 (로컬 접속용)

CREATE USER 'newuser'@'localhost' IDENTIFIED BY '5678';

-- 2. testdb에 대한 모든 권한 부여

GRANT ALL PRIVILEGES ON testdb.* TO 'newuser'@'localhost';

-- 3. 설정 변경 사항 즉시 적용

FLUSH PRIVILEGES;
```

3. 생성 확인
사용자가 정상적으로 생성되었고 권한이 있는지 확인합니다.
```sql
SHOW GRANTS FOR 'newuser'@'localhost';
```
이후 EXIT;를 입력하여 빠져나온 뒤, mysql -u newuser -p 명령어로 새 계정 접속 테스트를 진행할 수 있습니다.

## 6.2 사용자 삭제

- 사용자 삭제 (DROP USER)

가장 간단한 방법으로, 계정 자체를 제거합니다.

```sql
DROP USER 'username'@'localhost';
```

- 권한만 회수하고 싶은 경우 (REVOKE)

사용자 계정은 유지하되, 특정 데이터베이스(예: `testdb`)에 대한 권한만 뺏고 싶을 때 사용합니다.

```sql
REVOKE ALL PRIVILEGES ON testdb.* FROM 'username'@'localhost';
```

- 적용 및 확인

명령어 실행 후 설정을 적용하고 확인합니다.

```sql
-- 설정 적용
FLUSH PRIVILEGES;

-- 사용자 목록 확인
SELECT User, Host FROM mysql.user;
```

**주의:** 사용자 삭제 작업은 반드시 `root` 계정이나 그에 준하는 관리자 권한이 있는 계정으로 접속해서 수행해야 합니다.

## 6.3 데이터베이스에 등록된 사용자 보기

현재 MariaDB 서버에 생성된 모든 사용자 목록을 확인하려면 `mysql` 시스템 데이터베이스의 `user` 테이블을 조회하면 됩니다.

이 작업도 **root 계정**으로 접속한 상태에서 수행해야 합니다.

```sql
-- 사용자명과 접속 허용 호스트 확인
SELECT User, Host FROM mysql.user;
```

만약 더 상세한 정보(계정 잠금 여부, 비밀번호 유효 기간 등)를 보고 싶다면 아래 쿼리를 사용하세요.

```sql
SELECT * FROM mysql.user\G
```

*(끝에 `\G`를 붙이면 결과를 가로가 아닌 세로 형태로 보기 편하게 출력해 줍니다.)*

---

## 7. 새 사용자로 접속 테스트

왜 테스트하나?

* 권한 부여가 제대로 되었는지 확인
* 비밀번호 인증이 정상인지 확인

```bash
mysql -u testuser -p
```

비밀번호: `1234`

---

## 8. 테이블 생성/CRUD 테스트(실습용)

DB가 실제로 동작하는지 확인하기 위해 테이블 생성→삽입→조회까지 해봅니다.

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name) VALUES ('Choi'), ('Kim'), ('Lee');

SELECT * FROM users;
```

종료:

```sql
EXIT;
```

---

## 9. SQL 삭제 명령 (DELETE / TRUNCATE / DROP)

SQL에서 데이터 또는 테이블을 제거할 때 사용하는 명령은 크게 세 가지로 나뉜다.

`DELETE`는 테이블의 **행(row) 데이터만 삭제**하는 명령이며, 조건을 지정하여 특정 데이터만 제거할 수 있다.

```sql
DELETE FROM table_name
WHERE condition;
```

조건 없이 실행하면 테이블의 모든 데이터가 삭제되지만, 테이블 구조는 그대로 유지된다.

```sql
DELETE FROM table_name;
```

`TRUNCATE`는 테이블의 모든 데이터를 **한 번에 초기화**하는 명령으로, 실행 속도가 빠르지만 되돌릴 수 없다.

```sql
TRUNCATE TABLE table_name;
```

`DROP`은 테이블 자체를 완전히 삭제하여 **구조와 데이터가 모두 제거**된다.

```sql
DROP TABLE table_name;
```

정리하면, `DELETE`는 선택적 데이터 삭제, `TRUNCATE`는 전체 데이터 초기화, `DROP`은 테이블 제거를 의미한다.

## 10. SQL 수정 명령 (UPDATE)

UPDATE 문은 테이블의 기존 레코드를 수정하는 데 사용됩니다.

기본 구조
```sql
UPDATE table_name
SET column1 = value1, column2 = value2, ...
WHERE condition;
```
주요 특징
SET: 변경할 컬럼과 새로운 값을 지정합니다.
WHERE: 수정할 행(row)을 선별하는 조건을 지정합니다. 주의: WHERE 절을 생략하면 테이블의 모든 행이 수정됩니다.
예시
```sql
UPDATE users
SET name = 'Park', created_at = NOW()
WHERE id = 1;
```