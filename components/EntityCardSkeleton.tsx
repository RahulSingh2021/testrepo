
import React from 'react';
import Skeleton from './Skeleton';

const EntityCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 h-full min-h-[180px] flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-12 h-4 rounded-full" />
        </div>
        <Skeleton className="w-3/4 h-6 mb-2" />
        <Skeleton className="w-1/2 h-3 mb-4" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-16 h-3" />
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
        <Skeleton className="w-1/2 h-4" />
        <Skeleton className="w-6 h-6 rounded-full" />
      </div>
    </div>
  );
};

export default EntityCardSkeleton;
