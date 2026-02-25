# Database Analytics Integration Guide

## Overview
The Stock & Spoon app now includes comprehensive database analytics to track Firestore reads, writes, and other operations. This helps monitor performance, optimize costs, and understand usage patterns.

## Components Added

### 1. DatabaseAnalytics Component
A floating dashboard widget that displays real-time database metrics.

**Features:**
- Live reads/writes/deletes counters
- Session duration tracking
- Operations per minute calculations
- Console logging and metrics reset functionality

### 2. DatabaseMonitoringService
A wrapper service that tracks all Firestore operations automatically.

**Features:**
- Automatic operation counting
- Performance timing
- Error tracking
- Session-based metrics
- Firebase Analytics integration

### 3. Enhanced AnalyticsService
Extended with database operation tracking methods.

## Usage

### Importing the Dashboard Widget

The `DatabaseAnalytics` component has been automatically added to your main `App.tsx`:

```tsx
import DatabaseAnalytics from './components/DatabaseAnalytics';

// The component is included at the end of your App component's JSX
<DatabaseAnalytics />
```

### Using the Dashboard

1. **In Development**: The dashboard appears as a blue "📊 DB Analytics" button in the bottom-right corner
2. **Click to open**: Shows real-time metrics in a floating panel
3. **Track operations**: All database operations are automatically counted
4. **Log to console**: Click "Log to Console" to see detailed metrics in browser dev tools
5. **Reset metrics**: Click "Reset" to clear counters for a new session

### Integrating Database Monitoring

For enhanced tracking, replace direct Firestore calls with `DatabaseMonitoringService`:

```typescript
// Instead of:
import { getDocs, collection } from 'firebase/firestore';
const snapshot = await getDocs(collection(db, 'path'));

// Use:
import DatabaseMonitoringService from '../services/databaseMonitoringService';
const ref = DatabaseMonitoringService.collection('path');
const snapshot = await DatabaseMonitoringService.getDocs(query(ref));
```

### Files Updated with Database Monitoring

The following files have been updated to use `DatabaseMonitoringService` for enhanced analytics tracking:

#### Core Data Management
- **`hooks/useDataManagement.ts`**: Main data synchronization hook
  - Household inventory operations
  - User inventory operations  
  - Shopping list synchronization

#### Service Layer
- **`services/groceryPriceService.ts`**: Price data queries
  - Ingredient price lookups
  - Price trend analysis
  - Available ingredients listing

- **`services/householdService.ts`**: Household management
  - Household membership queries
  - User household lookups

- **`services/recipeService.ts`**: Recipe operations
  - Saved recipes retrieval
  - Recipe search functionality

### Available Monitoring Methods

```typescript
// Collection references
DatabaseMonitoringService.collection('path')

// Document operations
DatabaseMonitoringService.getDoc(ref)
DatabaseMonitoringService.setDoc(ref, data)
DatabaseMonitoringService.updateDoc(ref, data)
DatabaseMonitoringService.addDoc(ref, data)
DatabaseMonitoringService.deleteDoc(ref)

// Query operations
DatabaseMonitoringService.getDocs(queryRef)

// Batch operations
DatabaseMonitoringService.writeBatch()

// Real-time subscriptions
DatabaseMonitoringService.onSnapshot(ref, callback)
```

### Metrics Available

The service tracks:
- **Reads**: Individual document reads and query results
- **Writes**: Document creates, updates, and additions
- **Deletes**: Document deletions
- **Queries**: Firestore query executions
- **Batch Operations**: Batched write operations
- **Real-time Subscriptions**: Active listeners
- **Performance**: Operation timing and success rates

### Firebase Console Integration

For production monitoring, use the Firebase Console:

1. Go to: https://console.firebase.google.com/project/ornate-compass-478504-e1/firestore/usage
2. View real-time usage charts
3. Set up billing alerts
4. Monitor storage and index usage

### Cost Optimization Tips

Use the analytics to:
- Identify frequently accessed collections
- Monitor query efficiency
- Track subscription usage
- Optimize batch operations
- Plan capacity based on usage patterns

### Development vs Production

- **Development**: Use the dashboard widget for real-time monitoring
- **Production**: Rely on Firebase Console and Google Cloud Monitoring
- **Analytics**: Firebase Analytics receives operation events for user behavior correlation

## Example Integration

Here's how operations were updated across the codebase:

### useDataManagement.ts - Household Inventory
```typescript
// Before
const existingHouseholdInventoryDocs = await getDocs(collection(db, householdInventoryPath));

// After (with monitoring)
const householdInventoryRef = DatabaseMonitoringService.collection(householdInventoryPath);
const existingHouseholdInventoryDocs = await DatabaseMonitoringService.getDocs(query(householdInventoryRef));
```

### groceryPriceService.ts - Price Queries
```typescript
// Before
const querySnapshot = await getDocs(q);

// After (with monitoring)
const querySnapshot = await DatabaseMonitoringService.getDocs(q);
```

### recipeService.ts - Recipe Retrieval
```typescript
// Before
const q = query(collection(db, "recipes"), orderBy("dateSaved", "desc"));
const querySnapshot = await getDocs(q);

// After (with monitoring)
const recipesRef = DatabaseMonitoringService.collection("recipes");
const q = query(recipesRef, orderBy("dateSaved", "desc"));
const querySnapshot = await DatabaseMonitoringService.getDocs(q);
```

## Next Steps

1. Test the dashboard in development mode
2. Monitor operations during normal app usage
3. Review Firebase Console usage patterns
4. Optimize queries based on analytics data
5. Set up alerts for unusual usage patterns

The analytics system is now fully integrated and ready to provide insights into your app's database usage!</content>
<parameter name="filePath">c:\Users\cjohn\pantry\DATABASE_ANALYTICS_README.md