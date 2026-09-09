# Stage 1: Install dependencies
FROM node:18
WORKDIR /app

COPY package.json package-lock.json* ./

# Try legacy-peer-deps if needed
RUN npm install --legacy-peer-deps

# Stage 2: Build
COPY . .
RUN npm run build

# Stage 3: Run
# FROM node:18 AS runner
ENV NODE_ENV=production
#WORKDIR /app

COPY /app .

EXPOSE 3000
CMD ["npm", "start"]
