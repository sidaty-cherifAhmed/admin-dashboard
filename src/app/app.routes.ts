import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { UsersComponent } from './features/users/users.component';
import { RolesComponent } from './features/roles/roles.component';
import { CategoriesComponent } from './features/categories/categories.component';
import { ProductsComponent } from './features/products/products.component';
import { StocksComponent } from './features/stocks/stocks.component';
import { SalesPointsComponent } from './features/salespoints/salespoints.component';
import { VehiclesComponent } from './features/vehicles/vehicles.component';
import { TeamsComponent } from './features/teams/teams.component';
import { TeamMembersComponent } from './features/team-members/team-members.component';
import { ToursComponent } from './features/tours/tours.component';
import { LoginComponent } from './features/login/login.component';
import { authChildGuard, authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],

    children: [
      { path: 'users', component: UsersComponent },
      { path: 'roles', component: RolesComponent },
      { path: 'categories', component: CategoriesComponent },
      { path: 'products', component: ProductsComponent },
      { path: 'stocks', component: StocksComponent },
      { path: 'salespoints', component: SalesPointsComponent },
      { path: 'vehicles', component: VehiclesComponent },
      { path: 'teams', component: TeamsComponent },
      { path: 'team-members', component: TeamMembersComponent },
      { path: 'tours', component: ToursComponent },
      { path: '', redirectTo: 'users', pathMatch: 'full' },
    ],

  },
  
  { path: '**', redirectTo: '' },
];
